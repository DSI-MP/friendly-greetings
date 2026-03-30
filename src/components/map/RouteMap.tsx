import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { AlertTriangle, MapPin, Loader2 } from 'lucide-react';

interface Stop {
  lat: number;
  lng: number;
  label?: string;
  stopNumber?: number;
}

interface RouteGroup {
  id: number;
  group_code: string;
  corridor_label?: string;
  route_geometry?: number[][];
  center_lat?: number;
  center_lng?: number;
  members?: Stop[];
  color?: string;
}

interface RouteMapProps {
  groups: RouteGroup[];
  depotLat?: number;
  depotLng?: number;
  mapStyleUrl?: string;
  selectedGroupId?: number | null;
  onGroupSelect?: (groupId: number) => void;
  vehiclePosition?: { lat: number; lng: number } | null;
  className?: string;
}

interface RenderStats {
  validStops: number;
  invalidStops: number;
  validRouteCoords: number;
  invalidRouteCoords: number;
  hasRenderableData: boolean;
}

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ea580c', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#c026d3', '#0d9488',
];

const DEFAULT_RENDER_STATS: RenderStats = {
  validStops: 0,
  invalidStops: 0,
  validRouteCoords: 0,
  invalidRouteCoords: 0,
  hasRenderableData: false,
};

const NON_FATAL_CATEGORIES = new Set([
  'tile', 'tile_data', 'tile_auth',
  'sprite', 'sprite_auth',
  'glyph', 'glyph_auth',
]);

function isValidCoord(lat: unknown, lng: unknown): boolean {
  return lat != null && lng != null && Number.isFinite(+lat) && Number.isFinite(+lng);
}

function extractApiKey(url: string): string {
  try {
    return new URL(url).searchParams.get('key') || '';
  } catch {
    return '';
  }
}

function maskUrl(url: string): string {
  return url.replace(/([?&]key=)[^&]+/gi, '$1***');
}

function isAmazonMapsUrl(url: URL): boolean {
  return url.hostname.includes('maps.geo.') && url.hostname.includes('.amazonaws.com');
}

function classifyError(event: any): { title: string; detail: string; fatal: boolean; category: string } {
  const msg = String(event?.error?.message || event?.message || event?.error || '');
  const status = event?.error?.status ?? event?.status;
  const url = String(event?.error?.url || event?.url || '');

  if (msg.includes('Expected value to be of type') || msg.includes('but found null')) {
    return { title: 'Tile data warning', detail: 'Minor tile data type mismatch.', fatal: false, category: 'tile_data' };
  }
  if (status === 403 || msg.includes('403') || msg.includes('Forbidden')) {
    const sub = url.includes('sprite') ? 'sprite' : url.includes('glyph') ? 'glyph' : url.includes('tile') || url.includes('pbf') ? 'tile' : 'style';
    return {
      title: `Map ${sub} authentication failed`,
      detail: `API key lacks permission for ${sub} resources.`,
      fatal: sub === 'style',
      category: `${sub}_auth`,
    };
  }
  if (status === 401 || msg.includes('Unauthorized')) {
    return { title: 'API key rejected', detail: 'The API key is invalid or expired.', fatal: true, category: 'auth_rejected' };
  }
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('CORS')) {
    return { title: 'Network error', detail: 'Could not reach the map server.', fatal: true, category: 'network' };
  }
  if (msg.includes('style') || msg.includes('Style')) {
    return { title: 'Style load failed', detail: msg, fatal: true, category: 'style' };
  }
  return { title: 'Map error', detail: msg || 'Unknown error', fatal: false, category: 'unknown' };
}

async function waitForContainerReady(container: HTMLDivElement): Promise<DOMRect | null> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return rect;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return null;
}

export default function RouteMap({
  groups,
  depotLat = 6.0477241,
  depotLng = 80.2479661,
  mapStyleUrl,
  selectedGroupId,
  onGroupSelect,
  vehiclePosition,
  className,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const loadedRef = useRef(false);
  const initRunRef = useRef(0);
  const firstTileErrorLoggedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorInfo, setErrorInfo] = useState<{ title: string; detail: string } | null>(null);
  const [tileWarning, setTileWarning] = useState(false);
  const [renderStats, setRenderStats] = useState<RenderStats>(DEFAULT_RENDER_STATS);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
  }, []);

  const clearTimeout_ = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const visibleGroups = useMemo(
    () => (selectedGroupId ? groups.filter((group) => group.id === selectedGroupId) : groups),
    [groups, selectedGroupId],
  );

  useEffect(() => {
    let cancelled = false;
    const currentInitRun = initRunRef.current + 1;
    initRunRef.current = currentInitRun;

    const cleanupMap = () => {
      loadedRef.current = false;
      firstTileErrorLoggedRef.current = false;
      clearTimeout_();
      clearMarkers();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };

    if (!mapStyleUrl) {
      cleanupMap();
      setRenderStats(DEFAULT_RENDER_STATS);
      setStatus('error');
      setErrorInfo({ title: 'Map not configured', detail: 'No map style URL from backend. Ensure Amazon map config is available.' });
      return () => {
        cancelled = true;
        cleanupMap();
      };
    }

    const initializeMap = async () => {
      cleanupMap();
      setStatus('loading');
      setErrorInfo(null);
      setTileWarning(false);
      setRenderStats(DEFAULT_RENDER_STATS);

      const container = containerRef.current;
      if (!container) {
        setStatus('error');
        setErrorInfo({ title: 'Map initialization failed', detail: 'Map container is unavailable.' });
        return;
      }

      const rect = await waitForContainerReady(container);
      if (cancelled || initRunRef.current !== currentInitRun) return;

      console.info(`[RouteMap] container ${Math.round(rect?.width || 0)}x${Math.round(rect?.height || 0)}`);

      if (!rect || rect.width <= 0 || rect.height <= 0) {
        setStatus('error');
        setErrorInfo({ title: 'Map initialization failed', detail: 'Map container has no visible size yet.' });
        return;
      }

      try {
        const apiKey = extractApiKey(mapStyleUrl);

        // Pass the style URL directly to MapLibre — it fetches the descriptor natively.
        // transformRequest ensures all sub-resource requests get the API key appended.
        // Cache-busting: append timestamp to style URL
        const cacheBustUrl = (() => {
          try {
            const u = new URL(mapStyleUrl);
            u.searchParams.set('_cb', String(Date.now()));
            return u.toString();
          } catch { return mapStyleUrl; }
        })();

        const mapInstance = new maplibregl.Map({
          container,
          style: cacheBustUrl,
          center: [depotLng, depotLat],
          zoom: 10,
          attributionControl: false,
          transformRequest: (url: string) => {
            try {
              const urlObj = new URL(url);
              // Add cache-busting for tile requests
              if (isAmazonMapsUrl(urlObj)) {
                if (apiKey && !urlObj.searchParams.has('key')) {
                  urlObj.searchParams.set('key', apiKey);
                }
                if (!urlObj.searchParams.has('_cb')) {
                  urlObj.searchParams.set('_cb', String(Date.now()));
                }
                return { url: urlObj.toString() };
              }
            } catch {
              // invalid URL, pass through
            }
            return { url };
          },
        });

        mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');
        mapInstance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        // Fallback timeout: if map never fires 'load', show error (never false-ready)
        timeoutRef.current = setTimeout(() => {
          if (!loadedRef.current && !cancelled && initRunRef.current === currentInitRun) {
            console.warn('[RouteMap] load timeout 20s — map failed');
            setStatus('error');
            setErrorInfo({ title: 'Map failed to load', detail: 'Map style or tiles did not become ready in time. Please refresh.' });
          }
        }, 20000);

        // Primary ready signal
        mapInstance.on('load', () => {
          clearTimeout_();
          loadedRef.current = true;
          console.info('[RouteMap] map load event');
          setStatus('ready');
          setErrorInfo(null);
          // Triple repaint to avoid stuck blank canvas
          requestAnimationFrame(() => {
            try { mapInstance.resize(); mapInstance.triggerRepaint(); } catch {}
            setTimeout(() => {
              try { mapInstance.resize(); mapInstance.triggerRepaint(); } catch {}
            }, 100);
            setTimeout(() => {
              try { mapInstance.resize(); mapInstance.triggerRepaint(); } catch {}
            }, 400);
          });
        });

        // Use 'idle' as secondary confirmation (fires after all sources/tiles loaded)
        mapInstance.on('idle', () => {
          if (!loadedRef.current && !cancelled && initRunRef.current === currentInitRun) {
            try {
              if (mapInstance.isStyleLoaded()) {
                clearTimeout_();
                loadedRef.current = true;
                console.info('[RouteMap] idle event + style loaded — ready');
                setStatus('ready');
                setErrorInfo(null);
                requestAnimationFrame(() => { try { mapInstance.resize(); } catch {} });
              }
            } catch {}
          }
        });

        mapInstance.on('error', (event) => {
          const err = classifyError(event);
          const rawEvent = event as any;
          const rawUrl = String(rawEvent?.error?.url || rawEvent?.url || '');

          const isTileLike = NON_FATAL_CATEGORIES.has(err.category) || rawUrl.includes('/tiles/') || rawUrl.includes('.pbf');
          if (isTileLike && !firstTileErrorLoggedRef.current) {
            console.warn('[RouteMap] tile warning', { category: err.category, url: maskUrl(rawUrl) });
            firstTileErrorLoggedRef.current = true;
          }

          if (NON_FATAL_CATEGORIES.has(err.category)) {
            setTileWarning(true);
            return;
          }

          // Fatal error
          console.warn(`[RouteMap] fatal ${err.category}:`, err.title, maskUrl(rawUrl));
          clearTimeout_();
          setStatus('error');
          setErrorInfo({ title: err.title, detail: err.detail });
        });

        mapRef.current = mapInstance;

        requestAnimationFrame(() => {
          try { mapInstance.resize(); } catch {}
        });
      } catch (error: any) {
        console.error('[RouteMap] map init fail', error);
        setStatus('error');
        setErrorInfo({ title: 'Map initialization failed', detail: error?.message || 'Unable to initialize the map.' });
      }
    };

    void initializeMap();

    return () => {
      cancelled = true;
      cleanupMap();
      setStatus('loading');
    };
  }, [mapStyleUrl, depotLat, depotLng, clearMarkers, clearTimeout_]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const mapInstance = mapRef.current;
    if (!container || !mapInstance || status !== 'ready') return;

    const doResize = () => {
      try {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          mapInstance.resize();
        }
      } catch {}
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestAnimationFrame(doResize);
      }
    };

    const resizeObserver = new ResizeObserver(() => requestAnimationFrame(doResize));
    resizeObserver.observe(container);
    window.addEventListener('resize', doResize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    requestAnimationFrame(doResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', doResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [status]);

  // Draw overlays — only after map is truly ready
  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance || status !== 'ready') return;

    // Verify style is actually loaded before drawing
    try {
      if (!mapInstance.isStyleLoaded()) {
        console.warn('[RouteMap] overlay draw skipped — style not loaded yet');
        return;
      }
    } catch { return; }

    try {
      const style = mapInstance.getStyle();
      (style?.layers || []).forEach((layer) => {
        if (layer.id.startsWith('route-') || layer.id.startsWith('stops-')) mapInstance.removeLayer(layer.id);
      });
      Object.keys(style?.sources || {}).forEach((sourceId) => {
        if (sourceId.startsWith('route-') || sourceId.startsWith('stops-')) mapInstance.removeSource(sourceId);
      });
    } catch (e) {
      console.warn('[RouteMap] overlay cleanup error:', e);
    }

    clearMarkers();

    const nextStats: RenderStats = { ...DEFAULT_RENDER_STATS };

    const depotEl = document.createElement('div');
    depotEl.className = 'route-map-depot';
    depotEl.style.cssText = 'width:24px;height:24px;background:hsl(0,0%,10%);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:pointer;z-index:10;';
    depotEl.title = 'Depot / Factory';
    markersRef.current.push(new maplibregl.Marker({ element: depotEl }).setLngLat([depotLng, depotLat]).addTo(mapInstance));

    const bounds = new maplibregl.LngLatBounds([depotLng, depotLat], [depotLng, depotLat]);
    const drawGroups = selectedGroupId != null ? visibleGroups : groups;

    drawGroups.forEach((group, idx) => {
      const globalIdx = groups.indexOf(group);
      const color = group.color || COLORS[(globalIdx >= 0 ? globalIdx : idx) % COLORS.length];
      const srcId = `route-${group.id}`;
      const isSelected = selectedGroupId === group.id;

      if (group.route_geometry && group.route_geometry.length > 1) {
        const validCoords = group.route_geometry.filter((coord) => {
          const valid = Array.isArray(coord) && coord.length >= 2 && isValidCoord(coord[1], coord[0]);
          if (!valid) nextStats.invalidRouteCoords += 1;
          return valid;
        });

        if (validCoords.length > 1) {
          nextStats.validRouteCoords += validCoords.length;
          nextStats.hasRenderableData = true;
          mapInstance.addSource(srcId, {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: validCoords } },
          });
          mapInstance.addLayer({
            id: `route-line-${group.id}`,
            type: 'line',
            source: srcId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': color, 'line-width': isSelected ? 5 : 3, 'line-opacity': 0.85 },
          });
          validCoords.forEach((coord) => bounds.extend(coord as [number, number]));
        }
      } else if (group.members?.length) {
        const coords: number[][] = [[depotLng, depotLat]];
        group.members.forEach((stop) => {
          if (isValidCoord(stop.lat, stop.lng)) {
            coords.push([stop.lng, stop.lat]);
          } else {
            nextStats.invalidRouteCoords += 1;
          }
        });
        if (coords.length > 1) {
          nextStats.validRouteCoords += Math.max(coords.length - 1, 0);
          nextStats.hasRenderableData = true;
          mapInstance.addSource(srcId, {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
          });
          mapInstance.addLayer({
            id: `route-line-${group.id}`,
            type: 'line',
            source: srcId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': color, 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [4, 3] },
          });
        }
      }

      const stops = group.members || [];
      const large = stops.length > 20;
      stops.forEach((stop, si) => {
        if (!isValidCoord(stop.lat, stop.lng)) {
          nextStats.invalidStops += 1;
          return;
        }

        nextStats.validStops += 1;
        nextStats.hasRenderableData = true;
        bounds.extend([stop.lng, stop.lat]);

        const showLabel = !large || isSelected || si === 0 || si === stops.length - 1 || si % Math.ceil(stops.length / 10) === 0;
        const size = large && !isSelected ? 16 : 22;
        const fontSize = large && !isSelected ? 8 : 10;

        const el = document.createElement('div');
        el.style.cssText = `width:${size}px;height:${size}px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:700;color:#fff;cursor:pointer;`;
        el.textContent = showLabel ? String(stop.stopNumber ?? si + 1) : '';
        el.title = `${group.group_code} #${stop.stopNumber ?? si + 1}${stop.label ? ` – ${stop.label}` : ''}`;
        el.onclick = () => onGroupSelect?.(group.id);
        markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(mapInstance));
      });
    });

    if (vehiclePosition && isValidCoord(vehiclePosition.lat, vehiclePosition.lng)) {
      const vEl = document.createElement('div');
      vEl.style.cssText = 'width:16px;height:16px;background:#f59e0b;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(245,158,11,.6);';
      vEl.title = 'Vehicle (Live)';
      markersRef.current.push(new maplibregl.Marker({ element: vEl }).setLngLat([vehiclePosition.lng, vehiclePosition.lat]).addTo(mapInstance));
      bounds.extend([vehiclePosition.lng, vehiclePosition.lat]);
    }

    setRenderStats(nextStats);

    try {
      mapInstance.resize();
      if (nextStats.hasRenderableData) {
        mapInstance.fitBounds(bounds, { padding: 50, maxZoom: 14 });
      } else {
        mapInstance.easeTo({ center: [depotLng, depotLat], zoom: 10 });
      }
    } catch (e) {
      console.warn('[RouteMap] fitBounds/resize error:', e);
    }
  }, [groups, status, selectedGroupId, vehiclePosition, depotLat, depotLng, onGroupSelect, visibleGroups, clearMarkers]);

  if (status === 'error' || (!mapStyleUrl && !errorInfo)) {
    return (
      <div className={`w-full rounded-xl overflow-hidden border border-border bg-card flex min-h-[350px] flex-col items-center justify-center gap-3 p-8 text-center sm:min-h-[400px] lg:min-h-[550px] ${className || 'h-[400px]'}`}>
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">{errorInfo?.title || 'Map unavailable'}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">{errorInfo?.detail || 'No map style URL returned by backend.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-border bg-muted/20 min-h-[350px] sm:min-h-[400px] lg:min-h-[550px] ${className || 'h-[400px]'}`}>
      <div ref={containerRef} className="absolute inset-0 z-0" style={{ minHeight: '100%', minWidth: '100%', background: '#f8fafc' }} />

      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-card/80 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading map…</p>
        </div>
      )}

      {tileWarning && status === 'ready' && (
        <div className="absolute top-2 left-2 right-2 z-10 rounded-lg bg-card/95 border border-warning/30 px-3 py-2 text-xs text-warning shadow-sm flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Some map tiles failed to load — routes and stops remain visible.
        </div>
      )}

      {status === 'ready' && !renderStats.hasRenderableData && (
        <div className="absolute inset-x-3 top-3 bottom-3 z-10 flex items-center justify-center rounded-xl border border-border/60 bg-card/92 p-6 text-center shadow-sm backdrop-blur-sm">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">No valid route geometry or stops to display</p>
            <p className="text-xs text-muted-foreground">The depot loaded, but all route coordinates or member locations were invalid or missing.</p>
          </div>
        </div>
      )}

      {status === 'ready' && groups.length > 0 && (
        <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-card/90 backdrop-blur-sm border border-border px-3 py-1.5 text-xs text-muted-foreground shadow-sm flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {selectedGroupId ? '1 group' : `${groups.length} groups`} · {renderStats.validStops} stops
        </div>
      )}
    </div>
  );
}
