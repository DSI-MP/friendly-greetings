import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkflowApi } from '@/hooks/useWorkflowApi';
import type { GroupingRun } from '@/types/workflow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Map, Calendar, Route, Clock, MapPin,
  Users, AlertTriangle, Navigation, Loader2,
} from 'lucide-react';
import api from '@/lib/api';

const RouteMap = lazy(() => import('@/components/map/RouteMap'));

const ROUTE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ea580c', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#c026d3', '#0d9488',
];

interface MapConfig {
  provider?: string;
  region?: string | null;
  configStatus?: string;
  mapEnabled?: boolean;
  mapStyleUrl?: string | null;
  
  styleUrlRegion?: string | null;
  authMode?: string | null;
  regionMismatch?: boolean;
  degraded?: boolean;
  mapErrorMessage?: string | null;
  warnings?: string[];
}

export default function RouteMapPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { fetchDailyGroupingRun } = useWorkflowApi();
  const [run, setRun] = useState<GroupingRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [mapStyleUrl, setMapStyleUrl] = useState('');
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [runData, cfg] = await Promise.all([
          fetchDailyGroupingRun(date),
          api.get('/location/map-config', { params: { _t: Date.now() }, headers: { 'Cache-Control': 'no-cache' } })
            .then(r => r.data?.data ?? r.data).catch(() => null),
        ]);
        if (cancelled) return;
        setRun(runData);
        setMapConfig(cfg);
        if (cfg?.mapEnabled && cfg?.mapStyleUrl) {
          setMapStyleUrl(cfg.mapStyleUrl);
        } else {
          setMapStyleUrl('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const activeGroups = useMemo(
    () => run?.groups?.filter(g => g.status !== 'CANCELLED') || [],
    [run],
  );

  const mapGroups = useMemo(
    () => activeGroups.map(g => ({
      id: g.id,
      group_code: g.group_code,
      corridor_label: g.corridor_label,
      route_geometry: g.route_geometry,
      center_lat: g.center_lat,
      center_lng: g.center_lng,
      members: g.members?.map(m => ({
        lat: m.lat_snapshot,
        lng: m.lng_snapshot,
        label: m.full_name || `EMP-${m.employee_id}`,
        stopNumber: m.stop_sequence,
      })) || [],
    })),
    [activeGroups],
  );

  const totalDistKm = useMemo(
    () => activeGroups.reduce((s, g) => s + (Number(g.estimated_distance_km) || 0), 0),
    [activeGroups],
  );
  const totalDurMin = useMemo(
    () => Math.round(activeGroups.reduce((s, g) => s + (Number(g.estimated_duration_seconds) || 0), 0) / 60),
    [activeGroups],
  );
  const amazonGroups = useMemo(
    () => activeGroups.filter(g => g.routing_source === 'AMAZON_ROUTE').length,
    [activeGroups],
  );
  const totalEmployees = useMemo(
    () => activeGroups.reduce((s, g) => s + (g.employee_count || 0), 0),
    [activeGroups],
  );

  const handleGroupSelect = useCallback(
    (id: number | null) => setSelectedGroupId(id),
    [],
  );

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-[400px] lg:h-[550px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Main render ── */
  return (
    <div className="space-y-4 p-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="shrink-0 rounded-lg" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Map className="h-5 w-5 text-primary shrink-0" />
            Daily Route Map
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap mt-0.5">
            <Calendar className="h-3 w-3" />
            <span className="font-medium">{date}</span>
            {run && (
              <>
                <span className="mx-1">·</span>
                <span>Run #{run.run_number}</span>
                <span className="mx-1">·</span>
                <span>{activeGroups.length} groups</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Stats row */}
      {run && activeGroups.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Route className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{activeGroups.length}</p>
                <p className="text-[10px] text-muted-foreground">Routes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-accent/30 border-accent/20">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/40 flex items-center justify-center">
                <Users className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{totalEmployees}</p>
                <p className="text-[10px] text-muted-foreground">Employees</p>
              </div>
            </CardContent>
          </Card>
          {totalDistKm > 0 && (
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">{totalDistKm.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">km total</p>
                </div>
              </CardContent>
            </Card>
          )}
          {totalDurMin > 0 && (
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">{totalDurMin}</p>
                  <p className="text-[10px] text-muted-foreground">min total</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Routing badges */}
      <div className="flex flex-wrap gap-1.5">
        {mapConfig?.provider && (
          <Badge variant="outline" className="text-[10px]">{mapConfig.provider}</Badge>
        )}
        <Badge variant={mapConfig?.degraded === false ? 'default' : 'secondary'} className="text-[10px]">
          {mapConfig?.degraded === false ? 'Amazon Routing' : 'Fallback Mode'}
        </Badge>
        {amazonGroups > 0 && (
          <Badge variant="default" className="text-[10px]">
            {amazonGroups}/{activeGroups.length} optimised
          </Badge>
        )}
        {mapConfig?.configStatus && mapConfig.configStatus !== 'OK' && (
          <Badge variant="destructive" className="text-[10px]">
            Config: {mapConfig.configStatus}
          </Badge>
        )}
      </div>

      {/* Config warnings */}
      {(mapConfig?.mapErrorMessage || (mapConfig?.warnings && mapConfig.warnings.length > 0)) && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3 space-y-1">
            {mapConfig?.mapErrorMessage && (
              <p className="text-xs text-warning flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {mapConfig.mapErrorMessage}
              </p>
            )}
            {mapConfig?.warnings?.map((w, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {w}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* No run */}
      {!run ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Map className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No grouping run found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Run the daily grouping from the processing queue first.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/ta/processing')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Queue
            </Button>
          </CardContent>
        </Card>
      ) : activeGroups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Route className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">No active groups</p>
              <p className="text-xs text-muted-foreground mt-1">
                All groups may be cancelled or the run produced no groups.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ── Map + sidebar ── */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-2 max-h-[45vh] lg:max-h-[580px] overflow-y-auto pr-1">
            <Button
              variant={selectedGroupId === null ? 'default' : 'outline'}
              size="sm"
              className="w-full text-xs rounded-lg"
              onClick={() => setSelectedGroupId(null)}
            >
              <Map className="h-3.5 w-3.5 mr-1" />
              Show All ({activeGroups.length})
            </Button>

            {activeGroups.map((g, i) => {
              const distKm = g.estimated_distance_km ? Number(g.estimated_distance_km).toFixed(1) : null;
              const durMin = g.estimated_duration_seconds ? Math.round(Number(g.estimated_duration_seconds) / 60) : null;
              const isActive = selectedGroupId === g.id;
              const color = ROUTE_COLORS[i % ROUTE_COLORS.length];

              return (
                <Card
                  key={g.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    isActive
                      ? 'ring-2 ring-primary shadow-md'
                      : 'hover:shadow-sm hover:border-primary/30'
                  }`}
                  onClick={() => setSelectedGroupId(isActive ? null : g.id)}
                >
                  <CardContent className="p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                          style={{ background: color }}
                        />
                        <span className="font-mono text-xs font-bold text-foreground">{g.group_code}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {g.employee_count} <Users className="h-2.5 w-2.5 ml-0.5 inline" />
                      </Badge>
                    </div>
                    {g.corridor_label && (
                      <p className="text-[10px] text-muted-foreground truncate">{g.corridor_label}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {distKm && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />{distKm} km
                        </span>
                      )}
                      {durMin !== null && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />{durMin} min
                        </span>
                      )}
                      <Badge
                        variant={g.routing_source === 'AMAZON_ROUTE' ? 'default' : 'outline'}
                        className="text-[9px] px-1.5 py-0 ml-auto"
                      >
                        {g.routing_source === 'AMAZON_ROUTE' ? '✓ Optimised' : 'Haversine'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Map area */}
          <div className="lg:col-span-3 flex min-h-0 flex-col gap-2">
            <Card className="flex-1 overflow-hidden min-h-[350px] sm:min-h-[400px] lg:min-h-[550px]">
              <CardContent className="relative min-h-[350px] p-0 sm:min-h-[400px] lg:min-h-[550px]">
                <Suspense
                  fallback={
                    <div className="h-[350px] sm:h-[400px] lg:h-[550px] flex flex-col items-center justify-center gap-3 bg-muted/30">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Loading map component…</p>
                    </div>
                  }
                >
                  <RouteMap
                    groups={mapGroups}
                    mapStyleUrl={mapStyleUrl || undefined}
                    selectedGroupId={selectedGroupId}
                    onGroupSelect={handleGroupSelect}
                    className="h-[350px] sm:h-[400px] lg:h-[550px]"
                  />
                </Suspense>
              </CardContent>
            </Card>

            {run?.routing_warning && (
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="p-2.5 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                  <p className="text-xs text-muted-foreground">{run.routing_warning}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
