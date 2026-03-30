/**
 * Routing Provider Abstraction — V3
 *
 * All route intelligence flows through this interface.
 * Amazon Location is the primary provider; haversine is the degraded fallback.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distance_km: number;
  duration_seconds: number;
  geometry: number[][]; // [lng, lat] GeoJSON order
}

export interface MatrixEntry {
  distance_km: number;
  duration_seconds: number;
}

export interface OptimizedWaypoint {
  original_index: number;
  lat: number;
  lng: number;
}

export interface SnappedPoint {
  lat: number;
  lng: number;
  snapped: boolean;
}

export interface RoutingAvailability {
  routes: boolean;
  matrix: boolean;
  optimization: boolean;
  snapping: boolean;
  maps: boolean;
  tracking: boolean;
  geofences: boolean;
  provider: string;
  region: string;
  degraded: boolean;
}

export interface RoutingProvider {
  /** Provider identifier */
  getProviderLabel(): string;

  /** What capabilities are available */
  getAvailability(): RoutingAvailability;

  /** Calculate route between ordered waypoints */
  calculateRoute(waypoints: LatLng[]): Promise<RouteResult | null>;

  /** Get travel distance/duration matrix: origins × destinations */
  calculateRouteMatrix(origins: LatLng[], destinations: LatLng[]): Promise<MatrixEntry[][] | null>;

  /** Optimize visiting order for waypoints between departure and destination */
  optimizeWaypoints(departure: LatLng, destination: LatLng, waypoints: LatLng[]): Promise<OptimizedWaypoint[] | null>;

  /** Snap raw GPS coordinates to nearest road */
  snapToRoads(points: LatLng[]): Promise<SnappedPoint[] | null>;

  /** Map style URL for frontend rendering */
  getMapStyleUrl(): string;
}

/**
 * Haversine distance (km) — used as degraded fallback only.
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Bearing from point A to point B (degrees 0-360)
 */
export function calculateBearing(from: LatLng, to: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) - Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
