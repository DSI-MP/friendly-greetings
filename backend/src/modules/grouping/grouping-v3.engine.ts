import { Logger } from '@nestjs/common';
import { RoutingService } from '../routing/routing.service';
import { LatLng, MatrixEntry, haversineDistance, calculateBearing } from '../routing/routing-provider.interface';

/**
 * V3 Grouping Engine — Amazon-first, daily-run-only.
 *
 * Seven stages:
 *   A) Pre-bucketing by direction sectors (lightweight preparation only)
 *   B) Amazon route matrix intelligence (depot→stop AND stop→stop)
 *   C) Route-chain building (stop-to-stop travel-time adjacency)
 *   D) Vehicle planning (capacity-agnostic — keeps groups as natural route clusters)
 *   E) Segment partitioning (contiguous drop-off zones)
 *   F) Consolidation (travel-time-aware merging of underfilled segments)
 *   G) Stop order optimization (Amazon OptimizeWaypoints + route geometry)
 */

export interface EmployeeStop {
  employeeId: number;
  placeId?: number;
  lat: number;
  lng: number;
  sourceType: 'employee-direct' | 'place-fallback';
}

export interface GroupedSegment {
  segmentCode: string;
  corridorCode: string;
  stops: ResolvedStop[];
  estimatedDistanceKm: number;
  estimatedDurationSeconds: number;
  routeGeometry: number[][] | null;
  routingSource: 'AMAZON_ROUTE' | 'HAVERSINE_FALLBACK';
  centerLat: number;
  centerLng: number;
}

export interface ResolvedStop {
  employeeId: number;
  placeId?: number;
  lat: number;
  lng: number;
  stopSequence: number;
  depotDistanceKm: number;
  depotDurationSeconds: number;
}

export interface UnresolvedEmployee {
  employeeId: number;
  employeeName: string;
  empNo: string;
  reason: string;
}

export interface GroupingV3Result {
  segments: GroupedSegment[];
  unresolved: UnresolvedEmployee[];
  routingSource: 'AMAZON_ROUTE' | 'HAVERSINE_FALLBACK';
  warnings: string[];
  totalResolved: number;
  totalUnresolved: number;
}

export interface VehicleConfig {
  vanCapacity: number;
  busCapacity: number;
  vanSoftOverflow: number;
  busSoftOverflow: number;
  minVanOccupancy: number;
  minBusOccupancy: number;
}

const SECTOR_ANGLE = 30;
const MAX_MATRIX_BATCH = 25;
const LARGE_BUCKET_WINDOW = 20;

/** Bounded concurrency: run up to `limit` async tasks at once */
async function parallelLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

export class GroupingV3Engine {
  private readonly logger = new Logger(GroupingV3Engine.name);

  constructor(
    private readonly routing: RoutingService,
    private readonly vehicleConfig: VehicleConfig,
  ) {}

  async run(
    date: string,
    stops: EmployeeStop[],
    unresolvedEmployees: UnresolvedEmployee[],
  ): Promise<GroupingV3Result> {
    const warnings: string[] = [];
    const depot = this.routing.getDepot();
    const isAmazon = this.routing.isRouteIntelligenceAvailable();
    const routingSource = isAmazon ? 'AMAZON_ROUTE' as const : 'HAVERSINE_FALLBACK' as const;

    if (!isAmazon) {
      warnings.push('Amazon Location routing unavailable — using haversine fallback for all distance calculations.');
    }

    if (stops.length === 0) {
      warnings.push('No resolved stops to group.');
      return { segments: [], unresolved: unresolvedEmployees, routingSource, warnings, totalResolved: 0, totalUnresolved: unresolvedEmployees.length };
    }

    this.logger.log(`V3 Grouping [${date}]: ${stops.length} stops, routing=${routingSource}`);

    // ── Stage A: Pre-bucketing ──
    const buckets = this.preBucket(stops, depot);
    this.logger.log(`Stage A: ${buckets.size} direction buckets`);

    // ── Stage B: Matrix enrichment (parallel across buckets, limit=3) ──
    const { enrichedBuckets, stopToStopMatrices } = await this.enrichWithMatrix(buckets, depot, isAmazon, warnings);
    this.logger.log(`Stage B: Matrix enrichment complete`);

    // ── Stage C: Route-chain building ──
    const chains = this.buildRouteChains(enrichedBuckets, stopToStopMatrices, isAmazon);
    this.logger.log(`Stage C: ${chains.length} route chains`);

    // ── Stage D: Vehicle planning (capacity-agnostic) ──
    const rawSegments = this.planVehicleSegments(chains);
    this.logger.log(`Stage D: ${rawSegments.length} raw segments`);

    // ── Stage E+F: Consolidation ──
    const consolidated = this.consolidateSegments(rawSegments, stopToStopMatrices, depot);
    this.logger.log(`Stage E/F: ${consolidated.length} consolidated segments`);

    // ── Stage G: Stop order optimization + route calculation (parallel, limit=3) ──
    const finalSegments = await this.optimizeAndCalculateRoutes(date, consolidated, depot, isAmazon, warnings);
    this.logger.log(`Stage G: ${finalSegments.length} final segments with routes`);

    return {
      segments: finalSegments,
      unresolved: unresolvedEmployees,
      routingSource,
      warnings,
      totalResolved: stops.length,
      totalUnresolved: unresolvedEmployees.length,
    };
  }

  // ═══════════════════════════════════════════
  // Stage A: Pre-bucketing (lightweight only)
  // ═══════════════════════════════════════════

  private preBucket(stops: EmployeeStop[], depot: LatLng): Map<string, EnrichedStop[]> {
    const buckets = new Map<string, EnrichedStop[]>();

    for (const stop of stops) {
      const bearing = calculateBearing(depot, stop);
      const distance = haversineDistance(depot, stop);
      const sector = Math.floor(bearing / SECTOR_ANGLE);
      const corridorCode = `C${String(sector).padStart(2, '0')}`;

      const enriched: EnrichedStop = {
        ...stop,
        bearing,
        haversineDistanceKm: distance,
        corridorCode,
        roadDistanceKm: distance,
        roadDurationSeconds: distance * 120,
      };

      if (!buckets.has(corridorCode)) buckets.set(corridorCode, []);
      buckets.get(corridorCode)!.push(enriched);
    }

    return buckets;
  }

  // ═══════════════════════════════════════════
  // Stage B: Amazon Route Matrix
  // Buckets processed in parallel (limit=3)
  // ═══════════════════════════════════════════

  private async enrichWithMatrix(
    buckets: Map<string, EnrichedStop[]>,
    depot: LatLng,
    useAmazon: boolean,
    warnings: string[],
  ): Promise<{ enrichedBuckets: Map<string, EnrichedStop[]>; stopToStopMatrices: Map<string, MatrixEntry[][]> }> {
    const stopToStopMatrices = new Map<string, MatrixEntry[][]>();

    if (!useAmazon) return { enrichedBuckets: buckets, stopToStopMatrices };

    const bucketEntries = [...buckets.entries()].filter(([, stops]) => stops.length > 0);

    // Process buckets in parallel with bounded concurrency (3 concurrent AWS calls)
    const CONCURRENCY = 3;
    const tasks = bucketEntries.map(([code, stops]) => () => this.enrichBucket(code, stops, depot, warnings));
    const results = await parallelLimit(tasks, CONCURRENCY);

    for (let i = 0; i < results.length; i++) {
      const { s2sMatrix } = results[i];
      if (s2sMatrix) {
        stopToStopMatrices.set(bucketEntries[i][0], s2sMatrix);
      }
    }

    return { enrichedBuckets: buckets, stopToStopMatrices };
  }

  /** Enrich a single bucket — depot-to-stops + stop-to-stop matrices */
  private async enrichBucket(
    code: string,
    stops: EnrichedStop[],
    depot: LatLng,
    warnings: string[],
  ): Promise<{ s2sMatrix: MatrixEntry[][] | null }> {
    const stopCoords: LatLng[] = stops.map(s => ({ lat: s.lat, lng: s.lng }));
    let s2sMatrix: MatrixEntry[][] | null = null;

    try {
      // Depot→stops matrix in batches
      for (let i = 0; i < stopCoords.length; i += MAX_MATRIX_BATCH) {
        const batch = stopCoords.slice(i, i + MAX_MATRIX_BATCH);
        const matrix = await this.routing.getDepotToStopsMatrix(batch);
        if (matrix) {
          for (let j = 0; j < batch.length; j++) {
            const idx = i + j;
            if (idx < stops.length && matrix[j]) {
              stops[idx].roadDistanceKm = matrix[j].distance_km;
              stops[idx].roadDurationSeconds = matrix[j].duration_seconds;
            }
          }
        }
      }

      // Stop→stop matrix
      if (stops.length >= 2 && stops.length <= MAX_MATRIX_BATCH) {
        s2sMatrix = await this.routing.getStopToStopMatrix(stopCoords);
      } else if (stops.length > MAX_MATRIX_BATCH) {
        // Large bucket: sliding-window sub-batching
        const sortedIndices = stops.map((_, i) => i).sort((a, b) => stops[a].roadDistanceKm - stops[b].roadDistanceKm);
        const sparseMatrix: MatrixEntry[][] = Array.from({ length: stops.length }, () =>
          Array.from({ length: stops.length }, () => ({ distance_km: Infinity, duration_seconds: Infinity })),
        );

        const windowStep = Math.max(1, Math.floor(LARGE_BUCKET_WINDOW * 0.6));
        for (let winStart = 0; winStart < sortedIndices.length; winStart += windowStep) {
          const winIndices = sortedIndices.slice(winStart, winStart + LARGE_BUCKET_WINDOW);
          if (winIndices.length < 2) break;

          const winCoords: LatLng[] = winIndices.map(i => ({ lat: stops[i].lat, lng: stops[i].lng }));
          try {
            const winMatrix = await this.routing.getStopToStopMatrix(winCoords);
            if (winMatrix) {
              for (let r = 0; r < winIndices.length; r++) {
                for (let c = 0; c < winIndices.length; c++) {
                  const origR = winIndices[r];
                  const origC = winIndices[c];
                  if (winMatrix[r]?.[c] && winMatrix[r][c].duration_seconds < sparseMatrix[origR][origC].duration_seconds) {
                    sparseMatrix[origR][origC] = winMatrix[r][c];
                  }
                }
              }
            }
          } catch (err: any) {
            this.logger.warn(`Bucket ${code} window ${winStart} matrix failed: ${err?.message}`);
          }
        }

        s2sMatrix = sparseMatrix;
        warnings.push(`Bucket ${code}: ${stops.length} stops processed via sliding-window sub-batching (sparse matrix).`);
        this.logger.log(`Bucket ${code}: ${stops.length} stops — sparse matrix via sliding windows`);
      }
    } catch (err: any) {
      warnings.push(`Matrix enrichment failed for corridor ${code}: ${err?.message}. Using haversine fallback for this corridor.`);
      this.logger.warn(`Matrix enrichment failed for corridor ${code}: ${err?.message}`);
    }

    return { s2sMatrix };
  }

  // ═══════════════════════════════════════════
  // Stage C: Route-chain building (matrix-first)
  // ═══════════════════════════════════════════

  private buildRouteChains(
    buckets: Map<string, EnrichedStop[]>,
    stopToStopMatrices: Map<string, MatrixEntry[][]>,
    isAmazon: boolean,
  ): RouteChain[] {
    const chains: RouteChain[] = [];

    for (const [corridorCode, stops] of buckets) {
      if (stops.length === 0) continue;

      const s2sMatrix = stopToStopMatrices.get(corridorCode);
      let ordered: EnrichedStop[];
      let chainRoutingSource: 'AMAZON_ROUTE' | 'HAVERSINE_FALLBACK';

      if (s2sMatrix && isAmazon) {
        ordered = this.nearestNeighborChain(stops, s2sMatrix);
        chainRoutingSource = 'AMAZON_ROUTE';
      } else {
        ordered = [...stops].sort((a, b) => a.roadDistanceKm - b.roadDistanceKm);
        chainRoutingSource = 'HAVERSINE_FALLBACK';
      }

      chains.push({
        corridorCode,
        stops: ordered,
        totalEmployees: ordered.length,
        maxDistanceKm: Math.max(...ordered.map(s => s.roadDistanceKm)),
        minDistanceKm: Math.min(...ordered.map(s => s.roadDistanceKm)),
        routingSource: chainRoutingSource,
      });
    }

    chains.sort((a, b) => b.maxDistanceKm - a.maxDistanceKm);
    return chains;
  }

  /**
   * Nearest-neighbor greedy chain from farthest stop (drop-off: farthest first).
   */
  private nearestNeighborChain(stops: EnrichedStop[], matrix: MatrixEntry[][]): EnrichedStop[] {
    const n = stops.length;
    if (n <= 1) return [...stops];

    const used = new Set<number>();
    const result: EnrichedStop[] = [];

    // Start from farthest stop
    let currentIdx = 0;
    let maxDist = -1;
    for (let i = 0; i < n; i++) {
      if (stops[i].roadDistanceKm > maxDist) {
        maxDist = stops[i].roadDistanceKm;
        currentIdx = i;
      }
    }

    used.add(currentIdx);
    result.push(stops[currentIdx]);

    while (result.length < n) {
      let bestIdx = -1;
      let bestTime = Infinity;

      for (let j = 0; j < n; j++) {
        if (used.has(j)) continue;
        const entry = matrix[currentIdx]?.[j];
        const travelTime = entry?.duration_seconds ?? Infinity;
        if (travelTime < bestTime) {
          bestTime = travelTime;
          bestIdx = j;
        }
      }

      if (bestIdx === -1) {
        for (let j = 0; j < n; j++) {
          if (!used.has(j)) { result.push(stops[j]); used.add(j); }
        }
        break;
      }

      used.add(bestIdx);
      result.push(stops[bestIdx]);
      currentIdx = bestIdx;
    }

    return result;
  }

  // ═══════════════════════════════════════════
  // Stage D: Vehicle planning + segmentation
  // CAPACITY-AGNOSTIC: Groups are kept as natural route clusters.
  // The transport officer decides vehicle assignment later.
  // ═══════════════════════════════════════════

  private planVehicleSegments(chains: RouteChain[]): RawSegment[] {
    const { minVanOccupancy } = this.vehicleConfig;
    // Use a practical max group size — large enough to keep groups together
    // The transport officer will split further when assigning vehicles
    const MAX_GROUP_SIZE = 80; // practical upper limit per original group
    const segments: RawSegment[] = [];

    for (const chain of chains) {
      const n = chain.totalEmployees;

      if (n <= MAX_GROUP_SIZE) {
        // Keep as one group — officer decides vehicle(s) later
        segments.push({
          corridorCode: chain.corridorCode,
          stops: chain.stops,
          segmentType: 'GROUP',
          routingSource: chain.routingSource,
        });
      } else {
        // Very large corridor — split into practical sub-groups
        // Use distance-gap-based splitting for natural breakpoints
        const targetSize = Math.ceil(n / Math.ceil(n / MAX_GROUP_SIZE));
        for (let i = 0; i < n; i += targetSize) {
          const segStops = chain.stops.slice(i, Math.min(i + targetSize, n));
          segments.push({
            corridorCode: chain.corridorCode,
            stops: segStops,
            segmentType: 'GROUP',
            routingSource: chain.routingSource,
          });
        }
      }
    }

    return segments;
  }

  // ═══════════════════════════════════════════
  // Stage E/F: Consolidation (travel-time aware)
  // ═══════════════════════════════════════════

  private consolidateSegments(
    segments: RawSegment[],
    stopToStopMatrices: Map<string, MatrixEntry[][]>,
    depot: LatLng,
  ): RawSegment[] {
    if (segments.length <= 1) return segments;

    const { minVanOccupancy } = this.vehicleConfig;
    const MAX_MERGED = 80; // Keep groups manageable for later assignment

    // Merge underfilled segments within same corridor
    const byCorridor = new Map<string, RawSegment[]>();
    for (const seg of segments) {
      if (!byCorridor.has(seg.corridorCode)) byCorridor.set(seg.corridorCode, []);
      byCorridor.get(seg.corridorCode)!.push(seg);
    }

    const result: RawSegment[] = [];

    for (const [, corridorSegs] of byCorridor) {
      const merged: RawSegment[] = [];
      let current: RawSegment | null = null;

      for (const seg of corridorSegs) {
        if (!current) {
          current = { ...seg, stops: [...seg.stops] };
          continue;
        }
        const combined = current.stops.length + seg.stops.length;
        if (current.stops.length < minVanOccupancy && combined <= MAX_MERGED) {
          current.stops = [...current.stops, ...seg.stops];
        } else {
          merged.push(current);
          current = { ...seg, stops: [...seg.stops] };
        }
      }
      if (current) merged.push(current);
      result.push(...merged);
    }

    return this.absorbTinySegments(result, minVanOccupancy, MAX_MERGED, depot, stopToStopMatrices);
  }

  private absorbTinySegments(
    segments: RawSegment[],
    minOccupancy: number,
    maxMerged: number,
    depot: LatLng,
    stopToStopMatrices: Map<string, MatrixEntry[][]>,
  ): RawSegment[] {
    if (segments.length <= 1) return segments;

    const tiny: RawSegment[] = [];
    const viable: RawSegment[] = [];

    for (const seg of segments) {
      if (seg.stops.length < minOccupancy) tiny.push(seg);
      else viable.push(seg);
    }

    if (tiny.length === 0) return segments;

    for (const t of tiny) {
      const tAvgDuration = t.stops.reduce((s, x) => s + x.roadDurationSeconds, 0) / t.stops.length;
      const tAvgDist = t.stops.reduce((s, x) => s + x.roadDistanceKm, 0) / t.stops.length;

      let bestIdx = -1;
      let bestProximity = Infinity;

      for (let i = 0; i < viable.length; i++) {
        if (viable[i].stops.length + t.stops.length > maxMerged) continue;

        const vAvgDuration = viable[i].stops.reduce((s, x) => s + x.roadDurationSeconds, 0) / viable[i].stops.length;
        const vAvgDist = viable[i].stops.reduce((s, x) => s + x.roadDistanceKm, 0) / viable[i].stops.length;

        // Road-duration-first proximity metric
        const durationDiff = Math.abs(tAvgDuration - vAvgDuration);
        const distDiff = Math.abs(tAvgDist - vAvgDist);
        const proximity = durationDiff + distDiff * 60;

        if (proximity < bestProximity) {
          bestProximity = proximity;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        viable[bestIdx].stops.push(...t.stops);
      } else {
        viable.push(t);
      }
    }

    return viable;
  }

  // ═══════════════════════════════════════════
  // Stage G: Stop order optimization + routes
  // Segments processed in parallel (limit=3)
  // ═══════════════════════════════════════════

  private async optimizeAndCalculateRoutes(
    date: string,
    segments: RawSegment[],
    depot: LatLng,
    useAmazon: boolean,
    warnings: string[],
  ): Promise<GroupedSegment[]> {
    // Build tasks with pre-assigned segment codes
    const segCodes = segments.map((seg, i) =>
      `D${date.replace(/-/g, '').slice(4)}-${seg.corridorCode}-${String(i + 1).padStart(2, '0')}`,
    );

    const CONCURRENCY = 3;
    const tasks = segments.map((seg, i) => () =>
      this.optimizeSingleSegment(segCodes[i], seg, depot, useAmazon, warnings),
    );

    return parallelLimit(tasks, CONCURRENCY);
  }

  /** Optimize + calculate route for a single segment */
  private async optimizeSingleSegment(
    segCode: string,
    seg: RawSegment,
    depot: LatLng,
    useAmazon: boolean,
    warnings: string[],
  ): Promise<GroupedSegment> {
    let orderedStops: ResolvedStop[];
    let routeGeometry: number[][] | null = null;
    let estimatedDistanceKm = 0;
    let estimatedDurationSeconds = 0;
    let source: 'AMAZON_ROUTE' | 'HAVERSINE_FALLBACK' = seg.routingSource;

    if (useAmazon && seg.stops.length >= 2) {
      try {
        const stopCoords: LatLng[] = seg.stops.map(s => ({ lat: s.lat, lng: s.lng }));
        const optimized = await this.routing.optimizeStopOrder(stopCoords);

        if (optimized && optimized.length > 0) {
          orderedStops = optimized.map((wp, seq) => {
            const origStop = seg.stops[wp.original_index] || seg.stops[0];
            return {
              employeeId: origStop.employeeId,
              placeId: origStop.placeId,
              lat: origStop.lat,
              lng: origStop.lng,
              stopSequence: seq + 1,
              depotDistanceKm: origStop.roadDistanceKm,
              depotDurationSeconds: origStop.roadDurationSeconds,
            };
          });
          source = 'AMAZON_ROUTE';
        } else {
          orderedStops = this.farthestFirstOrder(seg.stops);
          source = 'HAVERSINE_FALLBACK';
          warnings.push(`Segment ${segCode}: Amazon waypoint optimization returned empty — using farthest-first fallback.`);
        }

        // Calculate route geometry
        const routeWaypoints: LatLng[] = [depot, ...orderedStops.map(s => ({ lat: s.lat, lng: s.lng }))];
        const route = await this.routing.calculateRoute(routeWaypoints);

        if (route) {
          routeGeometry = route.geometry;
          estimatedDistanceKm = route.distance_km;
          estimatedDurationSeconds = route.duration_seconds;
        } else {
          estimatedDistanceKm = this.estimateHaversineDistance(depot, orderedStops);
          estimatedDurationSeconds = estimatedDistanceKm * 120;
          source = 'HAVERSINE_FALLBACK';
          warnings.push(`Segment ${segCode}: Amazon route calculation failed — using haversine distance estimate.`);
        }
      } catch (err: any) {
        orderedStops = this.farthestFirstOrder(seg.stops);
        estimatedDistanceKm = this.estimateHaversineDistance(depot, orderedStops);
        estimatedDurationSeconds = estimatedDistanceKm * 120;
        source = 'HAVERSINE_FALLBACK';
        warnings.push(`Segment ${segCode}: Route optimization failed (${err?.message}) — using haversine fallback.`);
      }
    } else {
      orderedStops = this.farthestFirstOrder(seg.stops);
      estimatedDistanceKm = this.estimateHaversineDistance(depot, orderedStops);
      estimatedDurationSeconds = estimatedDistanceKm * 120;
      source = useAmazon && seg.stops.length < 2 ? seg.routingSource : 'HAVERSINE_FALLBACK';
    }

    const centerLat = orderedStops.reduce((s, x) => s + x.lat, 0) / orderedStops.length;
    const centerLng = orderedStops.reduce((s, x) => s + x.lng, 0) / orderedStops.length;

    return {
      segmentCode: segCode,
      corridorCode: seg.corridorCode,
      stops: orderedStops,
      estimatedDistanceKm,
      estimatedDurationSeconds,
      routeGeometry,
      routingSource: source,
      centerLat,
      centerLng,
    };
  }

  private farthestFirstOrder(stops: EnrichedStop[]): ResolvedStop[] {
    const sorted = [...stops].sort((a, b) => b.roadDistanceKm - a.roadDistanceKm);
    return sorted.map((s, i) => ({
      employeeId: s.employeeId,
      placeId: s.placeId,
      lat: s.lat,
      lng: s.lng,
      stopSequence: i + 1,
      depotDistanceKm: s.roadDistanceKm,
      depotDurationSeconds: s.roadDurationSeconds,
    }));
  }

  private estimateHaversineDistance(depot: LatLng, stops: ResolvedStop[]): number {
    if (stops.length === 0) return 0;
    let total = haversineDistance(depot, { lat: stops[0].lat, lng: stops[0].lng });
    for (let i = 1; i < stops.length; i++) {
      total += haversineDistance(
        { lat: stops[i - 1].lat, lng: stops[i - 1].lng },
        { lat: stops[i].lat, lng: stops[i].lng },
      );
    }
    return total;
  }
}

/* ── Internal types ── */

interface EnrichedStop extends EmployeeStop {
  bearing: number;
  haversineDistanceKm: number;
  corridorCode: string;
  roadDistanceKm: number;
  roadDurationSeconds: number;
}

interface RouteChain {
  corridorCode: string;
  stops: EnrichedStop[];
  totalEmployees: number;
  maxDistanceKm: number;
  minDistanceKm: number;
  routingSource: 'AMAZON_ROUTE' | 'HAVERSINE_FALLBACK';
}

interface RawSegment {
  corridorCode: string;
  stops: EnrichedStop[];
  segmentType: string;
  routingSource: 'AMAZON_ROUTE' | 'HAVERSINE_FALLBACK';
}
