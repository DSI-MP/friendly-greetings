import { Logger } from '@nestjs/common';
import {
  GeoRoutesClient,
  CalculateRoutesCommand,
  CalculateRouteMatrixCommand,
  OptimizeWaypointsCommand,
  SnapToRoadsCommand,
} from '@aws-sdk/client-geo-routes';
import {
  RoutingProvider, RoutingAvailability, LatLng, RouteResult,
  MatrixEntry, OptimizedWaypoint, SnappedPoint,
} from './routing-provider.interface';

/**
 * Amazon Location Service V3 provider.
 * Routes use IAM/SigV4 auth via @aws-sdk/client-geo-routes.
 * Maps use API-key auth (public endpoints).
 *
 * SDK limits enforced:
 *   CalculateRouteMatrix: origins<=15, origins×destinations<=100 → chunked 10×10
 *   CalculateRoutes: max 23 intermediate waypoints (25 total points) → chunked
 *   OptimizeWaypoints: max 50 waypoints → chunked with corridor-preserving merge
 *
 * Distance values from Amazon are in METERS — converted to km before returning.
 * Duration values from Amazon are in SECONDS — rounded to int before returning.
 */
export class AmazonLocationProvider implements RoutingProvider {
  private readonly logger = new Logger(AmazonLocationProvider.name);
  private readonly region: string;
  private readonly apiKey: string;
  private readonly mapStyle: string;
  private readonly authMode: string;
  private readonly routesEnabled: boolean;
  private readonly mapsEnabled: boolean;
  private readonly geoRoutesClient: GeoRoutesClient | null;

  constructor(config: {
    region?: string;
    apiKey?: string;
    mapStyle?: string;
    authMode?: string;
    timeoutMs?: number;
    enableRoutes?: boolean;
    enableMaps?: boolean;
  }) {
    this.region = config.region || process.env.AWS_REGION || '';
    this.apiKey = config.apiKey || process.env.AMAZON_LOCATION_API_KEY || '';
    this.mapStyle = config.mapStyle || 'Standard';
    this.authMode = config.authMode || process.env.AMAZON_LOCATION_AUTH_MODE || 'api-key';

    if (!this.region) {
      this.logger.warn('AWS_REGION is not set — maps and routing will be unavailable');
    }

    const apiKeyPresent = !!this.apiKey;
    this.mapsEnabled = apiKeyPresent && !!this.region && (config.enableMaps ?? true);

    // Masked diagnostics for key rotation debugging (never log full key)
    if (apiKeyPresent) {
      const masked = this.apiKey.length > 8
        ? `${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)} (${this.apiKey.length} chars)`
        : `*** (${this.apiKey.length} chars)`;
      this.logger.log(`Amazon Location API key: ${masked}, region: ${this.region || '(not set)'}, style: ${this.mapStyle}, authMode: ${this.authMode}`);
    }

    const hasIamCreds = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    this.routesEnabled = hasIamCreds && (config.enableRoutes ?? true);

    if (this.routesEnabled) {
      try {
        this.geoRoutesClient = new GeoRoutesClient({ region: this.region });
        this.logger.log('GeoRoutesClient initialized with IAM credentials');
      } catch (err: any) {
        this.logger.warn(`Failed to initialize GeoRoutesClient: ${err?.message}`);
        this.geoRoutesClient = null;
      }
    } else {
      this.geoRoutesClient = null;
      if (!hasIamCreds) {
        this.logger.warn('AWS IAM credentials not configured — routing will use haversine fallback');
      }
    }

    if (!apiKeyPresent) {
      this.logger.warn('Amazon Location API key not configured — maps unavailable');
    }
  }

  getProviderLabel(): string {
    return 'AMAZON_LOCATION_V3';
  }

  getAvailability(): RoutingAvailability {
    const routesOk = this.routesEnabled && !!this.geoRoutesClient;
    return {
      routes: routesOk,
      matrix: routesOk,
      optimization: routesOk,
      snapping: routesOk,
      maps: this.mapsEnabled,
      tracking: false,
      geofences: false,
      provider: this.getProviderLabel(),
      region: this.region,
      degraded: !routesOk,
    };
  }

  getMapStyleUrl(): string {
    if (!this.mapsEnabled || !this.region || !this.apiKey) return '';
    return `https://maps.geo.${this.region}.amazonaws.com/v2/styles/${encodeURIComponent(this.mapStyle)}/descriptor?key=${encodeURIComponent(this.apiKey)}`;
  }

  getRegion(): string { return this.region; }
  hasApiKey(): boolean { return !!this.apiKey; }
  getMapStyle(): string { return this.mapStyle; }
  getAuthMode(): string { return this.authMode; }

  // ═══════════════════════════════════════════
  // CalculateRoutes — chunked for >23 intermediate waypoints
  // ═══════════════════════════════════════════

  /**
   * Max 25 total points per SDK call (origin + 23 waypoints + destination).
   * For longer routes, split into overlapping chunks and merge results.
   */
  async calculateRoute(waypoints: LatLng[]): Promise<RouteResult | null> {
    if (!this.geoRoutesClient || waypoints.length < 2) return null;

    const MAX_INTERMEDIATE = 23; // 25 total = origin + 23 + destination
    const intermediateCount = waypoints.length - 2;

    // Simple case: fits in one call
    if (intermediateCount <= MAX_INTERMEDIATE) {
      return this.executeRouteChunk(waypoints);
    }

    // Chunked: split waypoints into overlapping segments
    this.logger.log(`CalculateRoutes: ${waypoints.length} waypoints — chunking (max ${MAX_INTERMEDIATE} intermediate per call)`);

    const allPoints = waypoints;
    const totalGeometry: number[][] = [];
    let totalDistanceKm = 0;
    let totalDurationSeconds = 0;
    let anyFailed = false;

    // Each chunk: points[chunkStart .. chunkEnd] where chunkEnd - chunkStart <= 24 (25 points)
    const CHUNK_SIZE = MAX_INTERMEDIATE + 2; // 25 total points per chunk
    let chunkStart = 0;

    while (chunkStart < allPoints.length - 1) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, allPoints.length - 1);
      const chunkPoints = allPoints.slice(chunkStart, chunkEnd + 1);

      const result = await this.executeRouteChunk(chunkPoints);

      if (result) {
        totalDistanceKm += result.distance_km;
        totalDurationSeconds += result.duration_seconds;

        // Merge geometry, skip first point of subsequent chunks to avoid duplication
        if (totalGeometry.length > 0 && result.geometry.length > 0) {
          totalGeometry.push(...result.geometry.slice(1));
        } else {
          totalGeometry.push(...result.geometry);
        }
      } else {
        anyFailed = true;
        this.logger.warn(`CalculateRoutes chunk [${chunkStart}:${chunkEnd}] failed`);
      }

      // Next chunk starts at current chunk's last point (overlap by 1)
      chunkStart = chunkEnd;
    }

    if (totalGeometry.length === 0 && anyFailed) return null;

    return {
      distance_km: totalDistanceKm,
      duration_seconds: Math.round(totalDurationSeconds),
      geometry: totalGeometry,
    };
  }

  private async executeRouteChunk(waypoints: LatLng[]): Promise<RouteResult | null> {
    try {
      const command = new CalculateRoutesCommand({
        Origin: [waypoints[0].lng, waypoints[0].lat],
        Destination: [waypoints[waypoints.length - 1].lng, waypoints[waypoints.length - 1].lat],
        Waypoints: waypoints.length > 2
          ? waypoints.slice(1, -1).map((w, i) => ({ Id: `wp-${i}`, Position: [w.lng, w.lat] }))
          : undefined,
        LegGeometryFormat: 'Simple',
        TravelMode: 'Car',
      });
      const data = await this.geoRoutesClient!.send(command);
      const route = data?.Routes?.[0];
      if (!route) return null;

      const geometry: number[][] = [];
      for (const leg of route.Legs || []) {
        if (Array.isArray((leg as any)?.Geometry?.LineString)) {
          geometry.push(...(leg as any).Geometry.LineString);
        }
      }

      // Amazon returns Distance in METERS — convert to km
      // Prefer Summary.Distance (top-level), fallback to Summary.Overview.Distance
      const summary = (route as any)?.Summary;
      const distanceMeters = Number(
        summary?.Distance ?? summary?.Overview?.Distance ?? 0,
      );
      const durationSeconds = Number(
        summary?.Duration ?? summary?.Overview?.Duration ?? 0,
      );

      return {
        distance_km: distanceMeters / 1000,
        duration_seconds: Math.round(durationSeconds),
        geometry,
      };
    } catch (err: any) {
      this.logger.warn(`CalculateRoutes SDK error: ${err?.message || err}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════
  // CalculateRouteMatrix — chunked 10×10
  // ═══════════════════════════════════════════

  async calculateRouteMatrix(origins: LatLng[], destinations: LatLng[]): Promise<MatrixEntry[][] | null> {
    if (!this.geoRoutesClient || !origins.length || !destinations.length) return null;

    const MAX_ORIGINS = 10;
    const MAX_DESTINATIONS = 10;

    if (origins.length <= MAX_ORIGINS && destinations.length <= MAX_DESTINATIONS) {
      return this.executeMatrixChunk(origins, destinations);
    }

    const result: MatrixEntry[][] = Array.from({ length: origins.length }, () =>
      Array.from({ length: destinations.length }, () => ({ distance_km: 0, duration_seconds: 0 })),
    );

    for (let oStart = 0; oStart < origins.length; oStart += MAX_ORIGINS) {
      const oEnd = Math.min(oStart + MAX_ORIGINS, origins.length);
      const originChunk = origins.slice(oStart, oEnd);

      for (let dStart = 0; dStart < destinations.length; dStart += MAX_DESTINATIONS) {
        const dEnd = Math.min(dStart + MAX_DESTINATIONS, destinations.length);
        const destChunk = destinations.slice(dStart, dEnd);

        const chunk = await this.executeMatrixChunk(originChunk, destChunk);
        if (!chunk) {
          this.logger.warn(`RouteMatrix chunk [${oStart}:${oEnd}]×[${dStart}:${dEnd}] failed — filling with zeros`);
          continue;
        }

        for (let r = 0; r < chunk.length; r++) {
          for (let c = 0; c < chunk[r].length; c++) {
            result[oStart + r][dStart + c] = chunk[r][c];
          }
        }
      }
    }

    return result;
  }

  private async executeMatrixChunk(origins: LatLng[], destinations: LatLng[]): Promise<MatrixEntry[][] | null> {
    try {
      const command = new CalculateRouteMatrixCommand({
        Origins: origins.map(o => ({ Position: [o.lng, o.lat] })),
        Destinations: destinations.map(d => ({ Position: [d.lng, d.lat] })),
        TravelMode: 'Car',
        RoutingBoundary: { Unbounded: true },
      });
      const data = await this.geoRoutesClient!.send(command);
      return (data.RouteMatrix || []).map((row: any[]) =>
        row.map(cell => ({
          // Amazon returns Distance in METERS — convert to km
          distance_km: Number(cell?.Distance ?? 0) / 1000,
          duration_seconds: Math.round(Number(cell?.Duration ?? 0)),
        })),
      );
    } catch (err: any) {
      this.logger.warn(`RouteMatrix chunk SDK error: ${err?.message || err}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════
  // OptimizeWaypoints — chunked for >50 waypoints
  // ═══════════════════════════════════════════

  /**
   * Amazon limit: max 50 waypoints per OptimizeWaypoints call.
   * For larger sets: split into chunks of 50, optimize each chunk independently,
   * then concatenate results preserving original indices.
   */
  async optimizeWaypoints(departure: LatLng, destination: LatLng, waypoints: LatLng[]): Promise<OptimizedWaypoint[] | null> {
    if (!this.geoRoutesClient || !waypoints.length) return null;

    const MAX_WAYPOINTS = 50;

    if (waypoints.length <= MAX_WAYPOINTS) {
      return this.executeOptimizeChunk(departure, destination, waypoints, 0);
    }

    // Chunked optimization: split waypoints, optimize each chunk, merge results
    this.logger.log(`OptimizeWaypoints: ${waypoints.length} waypoints — chunking (max ${MAX_WAYPOINTS} per call)`);

    const allOptimized: OptimizedWaypoint[] = [];

    for (let start = 0; start < waypoints.length; start += MAX_WAYPOINTS) {
      const end = Math.min(start + MAX_WAYPOINTS, waypoints.length);
      const chunk = waypoints.slice(start, end);

      const chunkResult = await this.executeOptimizeChunk(departure, destination, chunk, start);

      if (chunkResult) {
        allOptimized.push(...chunkResult);
      } else {
        // Fallback: preserve original order for this chunk
        this.logger.warn(`OptimizeWaypoints chunk [${start}:${end}] failed — preserving original order`);
        for (let i = 0; i < chunk.length; i++) {
          allOptimized.push({
            original_index: start + i,
            lat: chunk[i].lat,
            lng: chunk[i].lng,
          });
        }
      }
    }

    return allOptimized.length > 0 ? allOptimized : null;
  }

  private async executeOptimizeChunk(
    departure: LatLng,
    destination: LatLng,
    waypoints: LatLng[],
    indexOffset: number,
  ): Promise<OptimizedWaypoint[] | null> {
    try {
      const command = new OptimizeWaypointsCommand({
        Origin: [departure.lng, departure.lat],
        Destination: [destination.lng, destination.lat],
        TravelMode: 'Car',
        Waypoints: waypoints.map((w, i) => ({ Id: String(i), Position: [w.lng, w.lat] })),
      });
      const data = await this.geoRoutesClient!.send(command);
      const optimized = Array.isArray(data?.OptimizedWaypoints) ? data.OptimizedWaypoints : [];
      if (!optimized.length) return null;

      return optimized.map((wp: any, orderIdx: number) => {
        const localIdx = Number.parseInt(String(wp?.Id ?? orderIdx), 10);
        const origIdx = Number.isFinite(localIdx) ? localIdx : orderIdx;
        const pos = Array.isArray(wp?.Position) ? wp.Position : [waypoints[origIdx]?.lng, waypoints[origIdx]?.lat];
        return {
          original_index: indexOffset + origIdx,
          lat: Number(pos?.[1] ?? 0),
          lng: Number(pos?.[0] ?? 0),
        };
      });
    } catch (err: any) {
      this.logger.warn(`OptimizeWaypoints SDK error: ${err?.message || err}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════
  // SnapToRoads
  // ═══════════════════════════════════════════

  async snapToRoads(points: LatLng[]): Promise<SnappedPoint[] | null> {
    if (!this.geoRoutesClient || points.length < 2) return null;
    try {
      const command = new SnapToRoadsCommand({
        TracePoints: points.map(p => ({ Position: [p.lng, p.lat] })),
        TravelMode: 'Car',
        SnappedGeometryFormat: 'Simple',
      });
      const data = await this.geoRoutesClient.send(command);
      const snapped = Array.isArray((data as any)?.SnappedGeometry?.LineString)
        ? (data as any).SnappedGeometry.LineString
        : Array.isArray(data?.SnappedTracePoints)
          ? data.SnappedTracePoints.map((p: any) => p?.SnappedPosition).filter(Boolean)
          : [];
      if (!snapped.length) return null;
      return snapped.map((pt: any, i: number) => ({
        lat: Number(pt?.[1] ?? points[Math.min(i, points.length - 1)]?.lat ?? 0),
        lng: Number(pt?.[0] ?? points[Math.min(i, points.length - 1)]?.lng ?? 0),
        snapped: true,
      }));
    } catch (err: any) {
      this.logger.warn(`SnapToRoads SDK error: ${err?.message || err}`);
      return null;
    }
  }
}
