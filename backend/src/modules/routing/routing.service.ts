import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RoutingProvider, RoutingAvailability, LatLng, RouteResult,
  MatrixEntry, OptimizedWaypoint, SnappedPoint,
  haversineDistance, calculateBearing,
} from './routing-provider.interface';
import { AmazonLocationProvider } from './amazon-location.provider';

/**
 * Routing Service — V3 facade
 *
 * Routes all geospatial queries through the configured provider.
 * Falls back to haversine when provider is unavailable.
 */
@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly provider: RoutingProvider;
  private readonly depot: LatLng;

  constructor(private config: ConfigService) {
    this.provider = new AmazonLocationProvider({
      region: config.get('amazonLocation.region'),
      apiKey: config.get('amazonLocation.apiKey'),
      mapStyle: config.get('amazonLocation.mapStyle'),
      authMode: config.get('amazonLocation.authMode', 'api-key'),
      timeoutMs: config.get('amazonLocation.timeoutMs', 10000),
      enableRoutes: config.get('amazonLocation.enableRoutes', true),
      enableMaps: config.get('amazonLocation.enableMaps', true),
    });

    this.depot = {
      lat: config.get<number>('depot.lat', 6.0477241),
      lng: config.get<number>('depot.lng', 80.2479661),
    };

    const avail = this.provider.getAvailability();
    if (avail.degraded) {
      this.logger.warn('Routing provider is in DEGRADED mode — grouping will use haversine fallback');
    } else {
      this.logger.log(`Routing provider: ${avail.provider} — routes=${avail.routes}, matrix=${avail.matrix}, optimization=${avail.optimization}`);
    }
  }

  getDepot(): LatLng { return this.depot; }
  getAvailability(): RoutingAvailability { return this.provider.getAvailability(); }
  getMapStyleUrl(): string { return this.provider.getMapStyleUrl(); }
  getProviderLabel(): string { return this.provider.getProviderLabel(); }
  getRegion(): string { return (this.provider as AmazonLocationProvider).getRegion?.() || ''; }
  hasApiKey(): boolean { return (this.provider as AmazonLocationProvider).hasApiKey?.() || false; }
  getMapStyle(): string { return (this.provider as AmazonLocationProvider).getMapStyle?.() || ''; }
  getAuthMode(): string { return (this.provider as AmazonLocationProvider).getAuthMode?.() || 'api-key'; }

  /** Calculate route between waypoints */
  async calculateRoute(waypoints: LatLng[]): Promise<RouteResult | null> {
    return this.provider.calculateRoute(waypoints);
  }

  /** Depot-to-all-stops matrix (1 × N) */
  async getDepotToStopsMatrix(stops: LatLng[]): Promise<MatrixEntry[] | null> {
    if (!stops.length) return null;
    const matrix = await this.provider.calculateRouteMatrix([this.depot], stops);
    return matrix?.[0] ?? null;
  }

  /** Stop-to-stop matrix (N × N) */
  async getStopToStopMatrix(stops: LatLng[]): Promise<MatrixEntry[][] | null> {
    if (stops.length < 2) return null;
    return this.provider.calculateRouteMatrix(stops, stops);
  }

  /** Full origins × destinations matrix */
  async getRouteMatrix(origins: LatLng[], destinations: LatLng[]): Promise<MatrixEntry[][] | null> {
    return this.provider.calculateRouteMatrix(origins, destinations);
  }

  /** Optimize stop order for a segment */
  async optimizeStopOrder(stops: LatLng[]): Promise<OptimizedWaypoint[] | null> {
    if (stops.length < 2) return null;
    // For drop-off: depot → stops → depot (return trip)
    return this.provider.optimizeWaypoints(this.depot, this.depot, stops);
  }

  /** Snap coordinates to roads */
  async snapToRoads(points: LatLng[]): Promise<SnappedPoint[] | null> {
    return this.provider.snapToRoads(points);
  }

  /** Haversine fallback distance */
  haversineDistance(a: LatLng, b: LatLng): number {
    return haversineDistance(a, b);
  }

  /** Bearing from depot to a stop */
  bearingFromDepot(stop: LatLng): number {
    return calculateBearing(this.depot, stop);
  }

  /** Check if provider can provide route intelligence */
  isRouteIntelligenceAvailable(): boolean {
    const a = this.provider.getAvailability();
    return a.routes && a.matrix;
  }
}
