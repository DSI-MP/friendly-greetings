import { Logger } from '@nestjs/common';
import { RoutingService } from '../routing/routing.service';
import { LatLng, MatrixEntry, haversineDistance, calculateBearing } from '../routing/routing-provider.interface';

/**
 * V4 Grouping Engine — Enterprise-grade corridor splitting with operational realism.
 *
 * Key improvements:
 *   - Pre-segmentation of large buckets into geographic subgroups
 *   - Duration-based segment building (not just stop count)
 *   - Auto-correction loop for bad segments
 *   - Duration rebalancing between sibling segments
 *   - Readable route names from farthest stop/place
 *   - Structured validation with reason codes
 *
 * Stages:
 *   A) Pre-bucketing by direction sectors
 *   A2) Pre-segmentation of oversized buckets (distance bands + bearing sub-clusters)
 *   B) Amazon route matrix intelligence
 *   C) Master corridor chain building (ordered by travel-time adjacency)
 *   D) Duration-aware segment building with capacity + time constraints
 *   E) Auto-correction loop for segments exceeding hard limits
 *   F) Duration rebalancing between sibling segments
 *   G) Consolidation of underfilled segments
 *   H) Stop order optimization + route calculation
 *   I) Final validation pass
 */

/* ═══════════════ Config ═══════════════ */

export interface GroupingV4Config {
  /** Max travel time per segment in seconds (default: 5400 = 90 min) */
  maxSegmentDurationSeconds: number;
  /** Soft max — warning threshold */
  softMaxSegmentDurationSeconds: number;
  /** Hard max — must auto-correct above this */
  hardMaxSegmentDurationSeconds: number;
  /** Max stops per segment (default: 45) */
  maxSegmentStops: number;
  /** Micro-cluster protection radius in km (default: 1.5) */
  clusterProtectionRadiusKm: number;
  /** Minimum cut-point score to allow splitting (0-1, default: 0.25) */
  minCutPointScore: number;
  /** Max group size before forced splitting (default: 50) */
  maxGroupSize: number;
  /** Min occupancy for a viable segment (default: 5) */
  minSegmentOccupancy: number;
  /** Sector angle for pre-bucketing (default: 30°) */
  sectorAngle: number;
  /** Max matrix batch size for Amazon API (default: 25) */
  maxMatrixBatch: number;
  /** Large bucket sliding window size (default: 20) */
  largeBucketWindow: number;
  /** Threshold for pre-segmentation of oversized buckets */
  largeBucketThreshold: number;
  /** Max sub-group size from pre-segmentation */
  maxCorridorSubgroupSize: number;
  /** Max iterations for auto-correction loop */
  maxRebalanceIterations: number;
}

const DEFAULT_CONFIG: GroupingV4Config = {
  maxSegmentDurationSeconds: 5400,
  softMaxSegmentDurationSeconds: 4500,
  hardMaxSegmentDurationSeconds: 7200,
  maxSegmentStops: 45,
  clusterProtectionRadiusKm: 1.5,
  minCutPointScore: 0.25,
  maxGroupSize: 50,
  minSegmentOccupancy: 5,
  sectorAngle: 30,
  maxMatrixBatch: 25,
  largeBucketWindow: 20,
  largeBucketThreshold: 50,
  maxCorridorSubgroupSize: 40,
  maxRebalanceIterations: 5,
};

/* ═══════════════ Validation reason codes ═══════════════ */

export enum ValidationCode {
  EXCEEDS_HARD_MAX_DURATION = 'EXCEEDS_HARD_MAX_DURATION',
  EXCEEDS_SOFT_MAX_DURATION = 'EXCEEDS_SOFT_MAX_DURATION',
  EXCEEDS_MAX_STOPS = 'EXCEEDS_MAX_STOPS',
  SEGMENT_DURATION_IMBALANCE = 'SEGMENT_DURATION_IMBALANCE',
  LOW_DENSITY_LONG_ROUTE = 'LOW_DENSITY_LONG_ROUTE',
  NEEDS_REBALANCE = 'NEEDS_REBALANCE',
  NEEDS_BRANCH_SPLIT = 'NEEDS_BRANCH_SPLIT',
  UNDERFILLED = 'UNDERFILLED',
  LOW_QUALITY = 'LOW_QUALITY',
  EXCESSIVE_BACKTRACKING = 'EXCESSIVE_BACKTRACKING',
  AUTO_CORRECTED = 'AUTO_CORRECTED',
}

/* ═══════════════ Public types ═══════════════ */

export interface EmployeeStop {
  employeeId: number;
  placeId?: number;
  placeName?: string;
  lat: number;
  lng: number;
  sourceType: 'employee-direct' | 'place-fallback';
}

export interface ResolvedStop {
  employeeId: number;
  placeId?: number;
  placeName?: string;
  lat: number;
  lng: number;
  stopSequence: number;
  depotDistanceKm: number;
  depotDurationSeconds: number;
}

export interface SegmentExplanation {
  splitReason: string;
  qualityScore: number;
  continuityScore: number;
  occupancyRatio: number;
  warnings: string[];
  validationCodes: ValidationCode[];
  cutPointScore?: number;
  constraintForced?: string;
  correctionApplied?: string;
}

export interface GroupedSegment {
  segmentCode: string;
  corridorCode: string;
  routeName: string;
  stops: ResolvedStop[];
  estimatedDistanceKm: number;
  estimatedDurationSeconds: number;
  routeGeometry: number[][] | null;
  routingSource: 'AMAZON_ROUTE' | 'HAVERSINE_FALLBACK';
  centerLat: number;
  centerLng: number;
  explanation: SegmentExplanation;
}

export interface UnresolvedEmployee {
  employeeId: number;
  employeeName: string;
  empNo: string;
  reason: string;
}

export interface VehicleConfig {
  vanCapacity: number;
  busCapacity: number;
  vanSoftOverflow: number;
  busSoftOverflow: number;
  minVanOccupancy: number;
  minBusOccupancy: number;
}

export interface GroupingV4Result {
  segments: GroupedSegment[];
  unresolved: UnresolvedEmployee[];
  routingSource: 'AMAZON_ROUTE' | 'HAVERSINE_FALLBACK';
  warnings: string[];
  totalResolved: number;
  totalUnresolved: number;
  groupingVersion: 'V4';
  config: GroupingV4Config;
}

/* ═══════════════ Internal types ═══════════════ */

interface EnrichedStop extends EmployeeStop {
  bearing: number;
  haversineDistanceKm: number;
  corridorCode: string;
  roadDistanceKm: number;
  roadDurationSeconds: number;
}

interface CutPoint {
  index: number;
  score: number;
  reason: string;
  travelTimeGap: number;
  distanceGap: number;
  bearingChange: number;
  densityDrop: boolean;
  clusterBoundary: boolean;
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
  splitReason: string;
  cutPointScore?: number;
  constraintForced?: string;
}

/* ═══════════════ Utilities ═══════════════ */

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

/* ═══════════════ Engine ═══════════════ */

export class GroupingV4Engine {
  private readonly logger = new Logger(GroupingV4Engine.name);
  private readonly config: GroupingV4Config;

  constructor(
    private readonly routing: RoutingService,
    private readonly vehicleConfig: VehicleConfig,
    config?: Partial<GroupingV4Config>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async run(
    date: string,
    stops: EmployeeStop[],
    unresolvedEmployees: UnresolvedEmployee[],
  ): Promise<GroupingV4Result> {
    const warnings: string[] = [];
    const depot = this.routing.getDepot();
    const isAmazon = this.routing.isRouteIntelligenceAvailable();
    const routingSource = isAmazon ? 'AMAZON_ROUTE' as const : 'HAVERSINE_FALLBACK' as const;

    if (!isAmazon) {
      warnings.push('Amazon Location routing unavailable — using haversine fallback.');
    }

    if (stops.length === 0) {
      warnings.push('No resolved stops to group.');
      return {
        segments: [], unresolved: unresolvedEmployees, routingSource, warnings,
        totalResolved: 0, totalUnresolved: unresolvedEmployees.length,
        groupingVersion: 'V4', config: this.config,
      };
    }

    this.logger.log(`[V4] Grouping [${date}]: ${stops.length} stops, routing=${routingSource}`);

    // ── Stage A: Pre-bucketing ──
    const buckets = this.preBucket(stops, depot);
    this.logger.log(`[V4] Stage A: ${buckets.size} direction buckets`);

    // ── Stage A2: Pre-segmentation of oversized buckets ──
    const preSplit = this.preSegmentLargeBuckets(buckets, depot);
    this.logger.log(`[V4] Stage A2: ${preSplit.size} buckets after pre-segmentation`);

    // ── Stage B: Matrix enrichment ──
    const { stopToStopMatrices } = await this.enrichWithMatrix(preSplit, depot, isAmazon, warnings);
    this.logger.log(`[V4] Stage B: Matrix enrichment complete`);

    // ── Stage C: Master corridor chains ──
    const chains = this.buildRouteChains(preSplit, stopToStopMatrices, isAmazon);
    this.logger.log(`[V4] Stage C: ${chains.length} route chains`);

    // ── Stage D: Duration-aware segment building ──
    const rawSegments = this.buildDurationAwareSegments(chains, stopToStopMatrices);
    this.logger.log(`[V4] Stage D: ${rawSegments.length} segments after duration-aware splitting`);

    // ── Stage E: Auto-correction loop ──
    const corrected = this.autoCorrectionLoop(rawSegments, stopToStopMatrices, warnings);
    this.logger.log(`[V4] Stage E: ${corrected.length} segments after auto-correction`);

    // ── Stage F/G: Consolidation ──
    const consolidated = this.consolidateSegments(corrected, stopToStopMatrices, depot);
    this.logger.log(`[V4] Stage F/G: ${consolidated.length} consolidated segments`);

    // ── Stage H: Stop order optimization + route calculation ──
    let finalSegments = await this.optimizeAndCalculateRoutes(date, consolidated, depot, isAmazon, warnings);
    this.logger.log(`[V4] Stage H: ${finalSegments.length} final segments with routes`);

    // ── Stage E2: Post-route auto-correction (now with actual durations) ──
    finalSegments = this.postRouteAutoCorrection(finalSegments, warnings);

    // ── Stage I: Validation pass ──
    this.validateSegments(finalSegments, warnings);

    return {
      segments: finalSegments,
      unresolved: unresolvedEmployees,
      routingSource,
      warnings,
      totalResolved: stops.length,
      totalUnresolved: unresolvedEmployees.length,
      groupingVersion: 'V4',
      config: this.config,
    };
  }

  /* ═══════════════ Stage A: Pre-bucketing ═══════════════ */

  private preBucket(stops: EmployeeStop[], depot: LatLng): Map<string, EnrichedStop[]> {
    const buckets = new Map<string, EnrichedStop[]>();

    for (const stop of stops) {
      const bearing = calculateBearing(depot, stop);
      const distance = haversineDistance(depot, stop);
      const sector = Math.floor(bearing / this.config.sectorAngle);
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

  /* ═══════════════ Stage A2: Pre-segmentation of oversized buckets ═══════════════ */

  /**
   * Split large corridor buckets into smaller geographic subgroups using:
   * - distance bands from depot
   * - bearing sub-clustering within each band
   */
  private preSegmentLargeBuckets(
    buckets: Map<string, EnrichedStop[]>,
    depot: LatLng,
  ): Map<string, EnrichedStop[]> {
    const result = new Map<string, EnrichedStop[]>();
    const { largeBucketThreshold, maxCorridorSubgroupSize } = this.config;

    for (const [code, stops] of buckets) {
      if (stops.length <= largeBucketThreshold) {
        result.set(code, stops);
        continue;
      }

      this.logger.log(`[V4] Pre-segmenting oversized bucket ${code}: ${stops.length} stops`);

      // Sort by distance from depot
      const sorted = [...stops].sort((a, b) => a.haversineDistanceKm - b.haversineDistanceKm);

      // Determine number of distance bands
      const minDist = sorted[0].haversineDistanceKm;
      const maxDist = sorted[sorted.length - 1].haversineDistanceKm;
      const distRange = maxDist - minDist;

      // Target subgroup size determines number of bands
      const targetBands = Math.max(2, Math.ceil(stops.length / maxCorridorSubgroupSize));
      const bandWidth = distRange / targetBands;

      // Assign stops to distance bands
      const bands = new Map<number, EnrichedStop[]>();
      for (const stop of sorted) {
        let bandIdx = bandWidth > 0 ? Math.floor((stop.haversineDistanceKm - minDist) / bandWidth) : 0;
        bandIdx = Math.min(bandIdx, targetBands - 1);
        if (!bands.has(bandIdx)) bands.set(bandIdx, []);
        bands.get(bandIdx)!.push(stop);
      }

      // Further split bands that are still too large by bearing sub-clusters
      let subIdx = 0;
      for (const [bandIdx, bandStops] of [...bands.entries()].sort((a, b) => a[0] - b[0])) {
        if (bandStops.length <= maxCorridorSubgroupSize) {
          const subCode = `${code}S${String(subIdx).padStart(2, '0')}`;
          for (const s of bandStops) s.corridorCode = subCode;
          result.set(subCode, bandStops);
          subIdx++;
        } else {
          // Sub-split by bearing within this distance band
          const bearings = bandStops.map(s => s.bearing);
          const minBearing = Math.min(...bearings);
          const maxBearing = Math.max(...bearings);
          const bearingRange = maxBearing - minBearing;
          const subBands = Math.max(2, Math.ceil(bandStops.length / maxCorridorSubgroupSize));
          const subBandWidth = bearingRange / subBands;

          const bearingSubs = new Map<number, EnrichedStop[]>();
          for (const stop of bandStops) {
            let subBandIdx = subBandWidth > 0 ? Math.floor((stop.bearing - minBearing) / subBandWidth) : 0;
            subBandIdx = Math.min(subBandIdx, subBands - 1);
            if (!bearingSubs.has(subBandIdx)) bearingSubs.set(subBandIdx, []);
            bearingSubs.get(subBandIdx)!.push(stop);
          }

          for (const [, subStops] of [...bearingSubs.entries()].sort((a, b) => a[0] - b[0])) {
            const subCode = `${code}S${String(subIdx).padStart(2, '0')}`;
            for (const s of subStops) s.corridorCode = subCode;
            result.set(subCode, subStops);
            subIdx++;
          }
        }
      }

      this.logger.log(`[V4] Bucket ${code}: ${stops.length} stops → ${subIdx} subgroups`);
    }

    return result;
  }

  /* ═══════════════ Stage B: Matrix enrichment ═══════════════ */

  private async enrichWithMatrix(
    buckets: Map<string, EnrichedStop[]>,
    depot: LatLng,
    useAmazon: boolean,
    warnings: string[],
  ): Promise<{ stopToStopMatrices: Map<string, MatrixEntry[][]> }> {
    const stopToStopMatrices = new Map<string, MatrixEntry[][]>();
    if (!useAmazon) return { stopToStopMatrices };

    const bucketEntries = [...buckets.entries()].filter(([, stops]) => stops.length > 0);
    const tasks = bucketEntries.map(([code, stops]) => () => this.enrichBucket(code, stops, depot, warnings));
    const results = await parallelLimit(tasks, 3);

    for (let i = 0; i < results.length; i++) {
      if (results[i].s2sMatrix) {
        stopToStopMatrices.set(bucketEntries[i][0], results[i].s2sMatrix!);
      }
    }

    return { stopToStopMatrices };
  }

  private async enrichBucket(
    code: string, stops: EnrichedStop[], depot: LatLng, warnings: string[],
  ): Promise<{ s2sMatrix: MatrixEntry[][] | null }> {
    const stopCoords: LatLng[] = stops.map(s => ({ lat: s.lat, lng: s.lng }));
    let s2sMatrix: MatrixEntry[][] | null = null;
    const { maxMatrixBatch, largeBucketWindow } = this.config;

    try {
      for (let i = 0; i < stopCoords.length; i += maxMatrixBatch) {
        const batch = stopCoords.slice(i, i + maxMatrixBatch);
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

      if (stops.length >= 2 && stops.length <= maxMatrixBatch) {
        s2sMatrix = await this.routing.getStopToStopMatrix(stopCoords);
      } else if (stops.length > maxMatrixBatch) {
        const sortedIndices = stops.map((_, i) => i).sort((a, b) => stops[a].roadDistanceKm - stops[b].roadDistanceKm);
        const sparseMatrix: MatrixEntry[][] = Array.from({ length: stops.length }, () =>
          Array.from({ length: stops.length }, () => ({ distance_km: Infinity, duration_seconds: Infinity })),
        );

        const windowStep = Math.max(1, Math.floor(largeBucketWindow * 0.6));
        for (let winStart = 0; winStart < sortedIndices.length; winStart += windowStep) {
          const winIndices = sortedIndices.slice(winStart, winStart + largeBucketWindow);
          if (winIndices.length < 2) break;
          const winCoords = winIndices.map(i => ({ lat: stops[i].lat, lng: stops[i].lng }));
          try {
            const winMatrix = await this.routing.getStopToStopMatrix(winCoords);
            if (winMatrix) {
              for (let r = 0; r < winIndices.length; r++) {
                for (let c = 0; c < winIndices.length; c++) {
                  const origR = winIndices[r], origC = winIndices[c];
                  if (winMatrix[r]?.[c] && winMatrix[r][c].duration_seconds < sparseMatrix[origR][origC].duration_seconds) {
                    sparseMatrix[origR][origC] = winMatrix[r][c];
                  }
                }
              }
            }
          } catch (err: any) {
            this.logger.warn(`[V4] Bucket ${code} window ${winStart} matrix failed: ${err?.message}`);
          }
        }
        s2sMatrix = sparseMatrix;
      }
    } catch (err: any) {
      warnings.push(`Matrix enrichment failed for corridor ${code}: ${err?.message}. Using haversine.`);
      this.logger.warn(`[V4] Matrix enrichment failed for ${code}: ${err?.message}`);
    }

    return { s2sMatrix };
  }

  /* ═══════════════ Stage C: Route-chain building ═══════════════ */

  private buildRouteChains(
    buckets: Map<string, EnrichedStop[]>,
    matrices: Map<string, MatrixEntry[][]>,
    isAmazon: boolean,
  ): RouteChain[] {
    const chains: RouteChain[] = [];

    for (const [corridorCode, stops] of buckets) {
      if (stops.length === 0) continue;
      const s2s = matrices.get(corridorCode);
      let ordered: EnrichedStop[];
      let src: 'AMAZON_ROUTE' | 'HAVERSINE_FALLBACK';

      if (s2s && isAmazon) {
        ordered = this.nearestNeighborChain(stops, s2s);
        src = 'AMAZON_ROUTE';
      } else {
        // Order by distance from depot outward
        ordered = [...stops].sort((a, b) => a.roadDistanceKm - b.roadDistanceKm);
        src = 'HAVERSINE_FALLBACK';
      }

      chains.push({
        corridorCode,
        stops: ordered,
        totalEmployees: ordered.length,
        maxDistanceKm: Math.max(...ordered.map(s => s.roadDistanceKm)),
        minDistanceKm: Math.min(...ordered.map(s => s.roadDistanceKm)),
        routingSource: src,
      });
    }

    chains.sort((a, b) => b.maxDistanceKm - a.maxDistanceKm);
    return chains;
  }

  private nearestNeighborChain(stops: EnrichedStop[], matrix: MatrixEntry[][]): EnrichedStop[] {
    const n = stops.length;
    if (n <= 1) return [...stops];
    const used = new Set<number>();
    const result: EnrichedStop[] = [];

    // Start from farthest stop (drop-off order: farthest first)
    let currentIdx = 0;
    let maxDist = -1;
    for (let i = 0; i < n; i++) {
      if (stops[i].roadDistanceKm > maxDist) { maxDist = stops[i].roadDistanceKm; currentIdx = i; }
    }

    used.add(currentIdx);
    result.push(stops[currentIdx]);

    while (result.length < n) {
      let bestIdx = -1, bestTime = Infinity;
      for (let j = 0; j < n; j++) {
        if (used.has(j)) continue;
        const t = matrix[currentIdx]?.[j]?.duration_seconds ?? Infinity;
        if (t < bestTime) { bestTime = t; bestIdx = j; }
      }
      if (bestIdx === -1) {
        for (let j = 0; j < n; j++) if (!used.has(j)) { result.push(stops[j]); used.add(j); }
        break;
      }
      used.add(bestIdx);
      result.push(stops[bestIdx]);
      currentIdx = bestIdx;
    }
    return result;
  }

  /* ═══════════════ Stage D: Duration-aware segment building ═══════════════ */

  /**
   * Build segments respecting:
   * - Vehicle capacity (maxGroupSize)
   * - Estimated duration (maxSegmentDurationSeconds)
   * - Max stops (maxSegmentStops)
   * - Geographic continuity
   *
   * Key difference from old approach: accumulates duration stop-by-stop
   * and creates a new segment when any limit is approached.
   */
  private buildDurationAwareSegments(
    chains: RouteChain[],
    matrices: Map<string, MatrixEntry[][]>,
  ): RawSegment[] {
    const segments: RawSegment[] = [];

    for (const chain of chains) {
      const n = chain.totalEmployees;
      const s2s = matrices.get(chain.corridorCode);

      // Small enough to be a single segment
      const totalDuration = this.estimateChainDuration(chain.stops, s2s);
      if (n <= this.config.maxGroupSize && n <= this.config.maxSegmentStops &&
          totalDuration <= this.config.maxSegmentDurationSeconds) {
        segments.push({
          corridorCode: chain.corridorCode,
          stops: chain.stops,
          segmentType: 'GROUP',
          routingSource: chain.routingSource,
          splitReason: 'single_corridor_within_limits',
        });
        continue;
      }

      // Need to split — use duration-aware accumulation
      const builtSegments = this.buildSegmentsByDuration(chain, s2s);
      segments.push(...builtSegments);
    }

    return segments;
  }

  /**
   * Build segments by accumulating stops until duration/capacity limits are reached.
   * Uses natural cut-points when available for better splits.
   */
  private buildSegmentsByDuration(chain: RouteChain, s2s?: MatrixEntry[][] | null): RawSegment[] {
    const stops = chain.stops;
    const n = stops.length;
    const { maxSegmentDurationSeconds, maxSegmentStops, maxGroupSize } = this.config;

    // Compute cut-point scores for informed splitting
    const cutPoints = this.computeCutPoints(stops, s2s);

    // Build segments by accumulating duration
    const segments: RawSegment[] = [];
    let currentStops: EnrichedStop[] = [];
    let accumulatedDuration = 0;

    for (let i = 0; i < n; i++) {
      // Estimate incremental duration for adding this stop
      let incrementalDuration: number;
      if (i === 0 || currentStops.length === 0) {
        incrementalDuration = stops[i].roadDurationSeconds;
      } else {
        const prevStop = currentStops[currentStops.length - 1];
        incrementalDuration = s2s?.[i - 1]?.[i]?.duration_seconds ??
          (haversineDistance(prevStop, stops[i]) * 120);
      }

      const wouldExceedDuration = (accumulatedDuration + incrementalDuration) > maxSegmentDurationSeconds;
      const wouldExceedStops = (currentStops.length + 1) > maxSegmentStops;
      const wouldExceedCapacity = (currentStops.length + 1) > maxGroupSize;

      // Check if there's a good natural cut point here
      const cutPoint = cutPoints.find(cp => cp.index === i - 1);
      const isGoodCutPoint = cutPoint && cutPoint.score >= this.config.minCutPointScore;

      // Should we start a new segment?
      const shouldSplit = (wouldExceedDuration || wouldExceedStops || wouldExceedCapacity) &&
        currentStops.length >= this.config.minSegmentOccupancy;

      // Also split at good natural cut points if segment is reasonably sized
      const shouldSplitAtNaturalPoint = isGoodCutPoint &&
        currentStops.length >= this.config.minSegmentOccupancy &&
        accumulatedDuration > maxSegmentDurationSeconds * 0.5;

      if ((shouldSplit || shouldSplitAtNaturalPoint) && currentStops.length > 0) {
        let splitReason = 'duration_limit';
        if (wouldExceedCapacity) splitReason = 'capacity_limit';
        else if (wouldExceedStops) splitReason = 'stop_count_limit';
        else if (shouldSplitAtNaturalPoint) splitReason = `natural_cut_${cutPoint!.reason}`;

        segments.push({
          corridorCode: chain.corridorCode,
          stops: [...currentStops],
          segmentType: 'SPLIT',
          routingSource: chain.routingSource,
          splitReason,
          cutPointScore: cutPoint?.score,
          constraintForced: wouldExceedDuration ? 'max_ride_time' : wouldExceedCapacity ? 'capacity' : undefined,
        });

        currentStops = [];
        accumulatedDuration = 0;
      }

      currentStops.push(stops[i]);
      accumulatedDuration += incrementalDuration;
    }

    // Last segment
    if (currentStops.length > 0) {
      segments.push({
        corridorCode: chain.corridorCode,
        stops: currentStops,
        segmentType: segments.length > 0 ? 'SPLIT' : 'GROUP',
        routingSource: chain.routingSource,
        splitReason: segments.length > 0 ? 'remainder' : 'single_corridor_within_limits',
      });
    }

    return segments;
  }

  /* ═══════════════ Stage E: Auto-correction loop ═══════════════ */

  /**
   * Check segments for hard limit violations and auto-correct:
   * - Split segments exceeding hard max duration
   * - Rebalance sibling segments for duration balance
   */
  private autoCorrectionLoop(
    segments: RawSegment[],
    matrices: Map<string, MatrixEntry[][]>,
    warnings: string[],
  ): RawSegment[] {
    let current = [...segments];
    const { maxRebalanceIterations, hardMaxSegmentDurationSeconds, maxSegmentStops, maxGroupSize } = this.config;

    for (let iter = 0; iter < maxRebalanceIterations; iter++) {
      let changed = false;
      const next: RawSegment[] = [];

      for (const seg of current) {
        const estimatedDuration = this.estimateSegmentDuration(seg.stops, matrices.get(seg.corridorCode));

        // Check if segment exceeds hard limits
        const exceedsDuration = estimatedDuration > hardMaxSegmentDurationSeconds;
        const exceedsStops = seg.stops.length > maxSegmentStops;
        const exceedsCapacity = seg.stops.length > maxGroupSize;

        if ((exceedsDuration || exceedsStops || exceedsCapacity) && seg.stops.length >= this.config.minSegmentOccupancy * 2) {
          // Auto-split this segment
          const s2s = matrices.get(seg.corridorCode);
          const cutPoints = this.computeCutPoints(seg.stops, s2s);

          // Find best split point near the middle
          const midIdx = Math.floor(seg.stops.length / 2);
          let bestCut = midIdx;
          let bestScore = -1;

          for (const cp of cutPoints) {
            // Prefer cuts within 30% of middle
            const distFromMid = Math.abs(cp.index - midIdx) / seg.stops.length;
            if (distFromMid < 0.35 && cp.score > bestScore) {
              bestScore = cp.score;
              bestCut = cp.index + 1;
            }
          }

          // Ensure minimum size
          bestCut = Math.max(this.config.minSegmentOccupancy, Math.min(bestCut, seg.stops.length - this.config.minSegmentOccupancy));

          const firstHalf = seg.stops.slice(0, bestCut);
          const secondHalf = seg.stops.slice(bestCut);

          if (firstHalf.length > 0 && secondHalf.length > 0) {
            next.push({
              ...seg,
              stops: firstHalf,
              splitReason: 'auto_correction_split',
              constraintForced: exceedsDuration ? 'hard_max_duration' : 'hard_max_stops',
            });
            next.push({
              ...seg,
              stops: secondHalf,
              splitReason: 'auto_correction_split',
              constraintForced: exceedsDuration ? 'hard_max_duration' : 'hard_max_stops',
            });
            changed = true;
            warnings.push(`[AUTO-CORRECT] Split oversized segment (${seg.corridorCode}, ${seg.stops.length} stops, ~${Math.round(estimatedDuration / 60)}min) → 2 sub-segments`);
            continue;
          }
        }

        next.push(seg);
      }

      current = next;

      // Duration rebalancing between sibling segments in same corridor
      const rebalanced = this.rebalanceSiblingDurations(current, matrices, warnings);
      if (rebalanced.changed) {
        current = rebalanced.segments;
        changed = true;
      }

      if (!changed) break;
    }

    return current;
  }

  /**
   * Rebalance boundary stops between adjacent sibling segments (same corridor)
   * to reduce extreme duration imbalance.
   */
  private rebalanceSiblingDurations(
    segments: RawSegment[],
    matrices: Map<string, MatrixEntry[][]>,
    warnings: string[],
  ): { segments: RawSegment[]; changed: boolean } {
    let changed = false;
    const byCorridor = new Map<string, number[]>();

    for (let i = 0; i < segments.length; i++) {
      const code = segments[i].corridorCode;
      if (!byCorridor.has(code)) byCorridor.set(code, []);
      byCorridor.get(code)!.push(i);
    }

    for (const [code, indices] of byCorridor) {
      if (indices.length < 2) continue;
      const s2s = matrices.get(code);

      for (let k = 0; k < indices.length - 1; k++) {
        const iA = indices[k];
        const iB = indices[k + 1];
        const segA = segments[iA];
        const segB = segments[iB];

        const durA = this.estimateSegmentDuration(segA.stops, s2s);
        const durB = this.estimateSegmentDuration(segB.stops, s2s);

        if (durA <= 0 || durB <= 0) continue;
        const ratio = Math.max(durA, durB) / Math.min(durA, durB);
        if (ratio < 2.0) continue; // Acceptable imbalance

        // Try moving 1 boundary stop from longer to shorter
        if (durA > durB && segA.stops.length > this.config.minSegmentOccupancy) {
          const moved = segA.stops.pop()!;
          segB.stops.unshift(moved);
          changed = true;
        } else if (durB > durA && segB.stops.length > this.config.minSegmentOccupancy) {
          const moved = segB.stops.shift()!;
          segA.stops.push(moved);
          changed = true;
        }
      }
    }

    return { segments, changed };
  }

  /* ═══════════════ Cut-point analysis ═══════════════ */

  private computeCutPoints(stops: EnrichedStop[], s2s?: MatrixEntry[][] | null): CutPoint[] {
    const cutPoints: CutPoint[] = [];
    if (stops.length < 3) return cutPoints;

    const allGaps: number[] = [];
    const allDistGaps: number[] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const ttGap = s2s?.[i]?.[i + 1]?.duration_seconds ?? (haversineDistance(stops[i], stops[i + 1]) * 120);
      const distGap = haversineDistance(stops[i], stops[i + 1]);
      allGaps.push(ttGap);
      allDistGaps.push(distGap);
    }

    const avgGap = allGaps.reduce((a, b) => a + b, 0) / allGaps.length;
    const maxGap = Math.max(...allGaps);
    const avgDistGap = allDistGaps.reduce((a, b) => a + b, 0) / allDistGaps.length;

    for (let i = 0; i < stops.length - 1; i++) {
      const ttGap = allGaps[i];
      const distGap = allDistGaps[i];
      const bearingChange = Math.abs(stops[i].bearing - stops[i + 1].bearing);
      const normalizedBearing = Math.min(bearingChange, 360 - bearingChange);

      const isClusterBoundary = distGap > this.config.clusterProtectionRadiusKm;
      const isDensityDrop = distGap > avgDistGap * 2;
      const insideMicroCluster = !isClusterBoundary && distGap < this.config.clusterProtectionRadiusKm * 0.5;

      const travelTimeScore = maxGap > 0 ? Math.min(ttGap / maxGap, 1) : 0;
      const distanceScore = avgDistGap > 0 ? Math.min(distGap / (avgDistGap * 3), 1) : 0;
      const bearingScore = Math.min(normalizedBearing / 90, 1);
      const clusterBoundaryBonus = isClusterBoundary ? 0.2 : 0;
      const densityBonus = isDensityDrop ? 0.15 : 0;
      const microClusterPenalty = insideMicroCluster ? -0.4 : 0;

      const score = Math.max(0, Math.min(1,
        travelTimeScore * 0.35 +
        distanceScore * 0.25 +
        bearingScore * 0.15 +
        clusterBoundaryBonus +
        densityBonus +
        microClusterPenalty
      ));

      let reason = 'gap';
      if (ttGap > avgGap * 2) reason = 'travel_time_gap';
      else if (isClusterBoundary) reason = 'cluster_boundary';
      else if (isDensityDrop) reason = 'density_drop';
      else if (normalizedBearing > 45) reason = 'bearing_change';

      cutPoints.push({
        index: i, score, reason,
        travelTimeGap: ttGap, distanceGap: distGap, bearingChange: normalizedBearing,
        densityDrop: isDensityDrop, clusterBoundary: isClusterBoundary,
      });
    }

    return cutPoints;
  }

  /* ═══════════════ Duration estimation ═══════════════ */

  private estimateChainDuration(stops: EnrichedStop[], s2s?: MatrixEntry[][] | null): number {
    let total = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      total += s2s?.[i]?.[i + 1]?.duration_seconds ?? (haversineDistance(stops[i], stops[i + 1]) * 120);
    }
    // Add depot-to-first-stop travel time
    if (stops.length > 0) {
      total += stops[0].roadDurationSeconds;
    }
    return total;
  }

  private estimateSegmentDuration(stops: EnrichedStop[], s2s?: MatrixEntry[][] | null): number {
    if (stops.length === 0) return 0;
    // Simple estimation: depot to first stop + inter-stop travel
    let total = stops[0].roadDurationSeconds;
    for (let i = 0; i < stops.length - 1; i++) {
      total += s2s?.[i]?.[i + 1]?.duration_seconds ?? (haversineDistance(stops[i], stops[i + 1]) * 120);
    }
    return total;
  }

  /* ═══════════════ Stage F/G: Consolidation ═══════════════ */

  private consolidateSegments(
    segments: RawSegment[],
    matrices: Map<string, MatrixEntry[][]>,
    depot: LatLng,
  ): RawSegment[] {
    if (segments.length <= 1) return segments;

    const { minSegmentOccupancy, maxGroupSize } = this.config;

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
        if (!current) { current = { ...seg, stops: [...seg.stops] }; continue; }
        const combined = current.stops.length + seg.stops.length;
        if (current.stops.length < minSegmentOccupancy && combined <= maxGroupSize) {
          current.stops = [...current.stops, ...seg.stops];
          current.splitReason = 'merged_underfilled';
        } else {
          merged.push(current);
          current = { ...seg, stops: [...seg.stops] };
        }
      }
      if (current) merged.push(current);
      result.push(...merged);
    }

    return this.absorbTinySegments(result, depot);
  }

  private absorbTinySegments(segments: RawSegment[], depot: LatLng): RawSegment[] {
    if (segments.length <= 1) return segments;
    const { minSegmentOccupancy, maxGroupSize } = this.config;

    const tiny: RawSegment[] = [];
    const viable: RawSegment[] = [];

    for (const seg of segments) {
      if (seg.stops.length < minSegmentOccupancy) tiny.push(seg);
      else viable.push(seg);
    }

    if (tiny.length === 0) return segments;

    for (const t of tiny) {
      const tCenter = this.computeCenter(t.stops);
      let bestIdx = -1, bestDist = Infinity;

      for (let i = 0; i < viable.length; i++) {
        if (viable[i].stops.length + t.stops.length > maxGroupSize) continue;
        const vCenter = this.computeCenter(viable[i].stops);
        const dist = haversineDistance(tCenter, vCenter);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }

      if (bestIdx >= 0) viable[bestIdx].stops.push(...t.stops);
      else viable.push(t);
    }

    return viable;
  }

  private computeCenter(stops: { lat: number; lng: number }[]): LatLng {
    const lat = stops.reduce((s, x) => s + x.lat, 0) / stops.length;
    const lng = stops.reduce((s, x) => s + x.lng, 0) / stops.length;
    return { lat, lng };
  }

  /* ═══════════════ Stage H: Stop order optimization + routes ═══════════════ */

  private async optimizeAndCalculateRoutes(
    date: string, segments: RawSegment[], depot: LatLng,
    useAmazon: boolean, warnings: string[],
  ): Promise<GroupedSegment[]> {
    const segCodes = segments.map((seg, i) =>
      `D${date.replace(/-/g, '').slice(4)}-${seg.corridorCode}-${String(i + 1).padStart(2, '0')}`,
    );

    const tasks = segments.map((seg, i) => () =>
      this.optimizeSingleSegment(segCodes[i], seg, depot, useAmazon, warnings),
    );

    return parallelLimit(tasks, 3);
  }

  private async optimizeSingleSegment(
    segCode: string, seg: RawSegment, depot: LatLng,
    useAmazon: boolean, warnings: string[],
  ): Promise<GroupedSegment> {
    let orderedStops: ResolvedStop[];
    let routeGeometry: number[][] | null = null;
    let estimatedDistanceKm = 0;
    let estimatedDurationSeconds = 0;
    let source: 'AMAZON_ROUTE' | 'HAVERSINE_FALLBACK' = seg.routingSource;

    if (useAmazon && seg.stops.length >= 2) {
      try {
        const stopCoords = seg.stops.map(s => ({ lat: s.lat, lng: s.lng }));
        const optimized = await this.routing.optimizeStopOrder(stopCoords);

        if (optimized && optimized.length > 0) {
          const seen = new Set<number>();
          const rawStops: ResolvedStop[] = [];
          for (const wp of optimized) {
            const orig = (wp.original_index >= 0 && wp.original_index < seg.stops.length)
              ? seg.stops[wp.original_index] : null;
            if (!orig || seen.has(orig.employeeId)) continue;
            seen.add(orig.employeeId);
            rawStops.push({
              employeeId: orig.employeeId, placeId: orig.placeId, placeName: orig.placeName,
              lat: orig.lat, lng: orig.lng, stopSequence: rawStops.length + 1,
              depotDistanceKm: orig.roadDistanceKm, depotDurationSeconds: orig.roadDurationSeconds,
            });
          }
          for (const s of seg.stops) {
            if (!seen.has(s.employeeId)) {
              seen.add(s.employeeId);
              rawStops.push({
                employeeId: s.employeeId, placeId: s.placeId, placeName: s.placeName,
                lat: s.lat, lng: s.lng, stopSequence: rawStops.length + 1,
                depotDistanceKm: s.roadDistanceKm, depotDurationSeconds: s.roadDurationSeconds,
              });
            }
          }
          orderedStops = rawStops;
          source = 'AMAZON_ROUTE';
        } else {
          orderedStops = this.farthestFirstOrder(seg.stops);
          source = 'HAVERSINE_FALLBACK';
        }

        const routeWaypoints = [depot, ...orderedStops.map(s => ({ lat: s.lat, lng: s.lng }))];
        const route = await this.routing.calculateRoute(routeWaypoints);
        if (route) {
          routeGeometry = route.geometry;
          estimatedDistanceKm = route.distance_km;
          estimatedDurationSeconds = route.duration_seconds;
        } else {
          estimatedDistanceKm = this.estimateHaversineDistance(depot, orderedStops);
          estimatedDurationSeconds = estimatedDistanceKm * 120;
          source = 'HAVERSINE_FALLBACK';
        }
      } catch (err: any) {
        orderedStops = this.farthestFirstOrder(seg.stops);
        estimatedDistanceKm = this.estimateHaversineDistance(depot, orderedStops);
        estimatedDurationSeconds = estimatedDistanceKm * 120;
        source = 'HAVERSINE_FALLBACK';
        warnings.push(`Segment ${segCode}: optimization failed (${err?.message}) — haversine fallback.`);
      }
    } else {
      orderedStops = this.farthestFirstOrder(seg.stops);
      estimatedDistanceKm = this.estimateHaversineDistance(depot, orderedStops);
      estimatedDurationSeconds = estimatedDistanceKm * 120;
    }

    const centerLat = orderedStops.reduce((s, x) => s + x.lat, 0) / orderedStops.length;
    const centerLng = orderedStops.reduce((s, x) => s + x.lng, 0) / orderedStops.length;

    // Build readable route name from farthest stop
    const routeName = this.generateRouteName(orderedStops, seg.corridorCode);

    // Compute quality scores
    const maxCap = Math.max(this.vehicleConfig.vanCapacity, this.vehicleConfig.busCapacity);
    const occupancyRatio = orderedStops.length / maxCap;
    const continuityScore = this.computeContinuityScore(orderedStops);
    const qualityScore = (continuityScore * 0.5) + (Math.min(occupancyRatio, 1) * 0.3) +
      (estimatedDurationSeconds < this.config.maxSegmentDurationSeconds ? 0.2 : 0);

    const segWarnings: string[] = [];
    const validationCodes: ValidationCode[] = [];

    if (estimatedDurationSeconds > this.config.hardMaxSegmentDurationSeconds) {
      segWarnings.push(`Duration ${Math.round(estimatedDurationSeconds / 60)}min exceeds hard max ${Math.round(this.config.hardMaxSegmentDurationSeconds / 60)}min`);
      validationCodes.push(ValidationCode.EXCEEDS_HARD_MAX_DURATION);
    } else if (estimatedDurationSeconds > this.config.softMaxSegmentDurationSeconds) {
      segWarnings.push(`Duration ${Math.round(estimatedDurationSeconds / 60)}min exceeds soft max ${Math.round(this.config.softMaxSegmentDurationSeconds / 60)}min`);
      validationCodes.push(ValidationCode.EXCEEDS_SOFT_MAX_DURATION);
    }
    if (orderedStops.length > this.config.maxSegmentStops) {
      segWarnings.push(`${orderedStops.length} stops exceeds max ${this.config.maxSegmentStops}`);
      validationCodes.push(ValidationCode.EXCEEDS_MAX_STOPS);
    }

    // Low density detection: few stops spread over long distance
    if (orderedStops.length < 10 && estimatedDurationSeconds > this.config.softMaxSegmentDurationSeconds) {
      validationCodes.push(ValidationCode.LOW_DENSITY_LONG_ROUTE);
    }

    return {
      segmentCode: segCode,
      corridorCode: seg.corridorCode,
      routeName,
      stops: orderedStops,
      estimatedDistanceKm,
      estimatedDurationSeconds,
      routeGeometry,
      routingSource: source,
      centerLat,
      centerLng,
      explanation: {
        splitReason: seg.splitReason,
        qualityScore: Math.round(qualityScore * 100) / 100,
        continuityScore: Math.round(continuityScore * 100) / 100,
        occupancyRatio: Math.round(occupancyRatio * 100) / 100,
        warnings: segWarnings,
        validationCodes,
        cutPointScore: seg.cutPointScore,
        constraintForced: seg.constraintForced,
        correctionApplied: seg.splitReason.startsWith('auto_correction') ? seg.splitReason : undefined,
      },
    };
  }

  /* ═══════════════ Post-route auto-correction ═══════════════ */

  /**
   * After routes are calculated with real durations, do a final check
   * and rebalance if needed.
   */
  private postRouteAutoCorrection(segments: GroupedSegment[], warnings: string[]): GroupedSegment[] {
    // Check for extreme imbalance between corridor siblings
    const byCorridor = new Map<string, GroupedSegment[]>();
    for (const seg of segments) {
      // Use base corridor (strip S## suffix)
      const baseCorridor = seg.corridorCode.replace(/S\d+$/, '');
      if (!byCorridor.has(baseCorridor)) byCorridor.set(baseCorridor, []);
      byCorridor.get(baseCorridor)!.push(seg);
    }

    for (const [corridor, siblings] of byCorridor) {
      if (siblings.length < 2) continue;
      const durations = siblings.map(s => s.estimatedDurationSeconds);
      const maxD = Math.max(...durations);
      const minD = Math.min(...durations);

      if (maxD > 0 && minD > 0 && maxD / minD > 3) {
        warnings.push(`[POST-ROUTE] Corridor ${corridor}: imbalanced durations (${Math.round(minD / 60)}min–${Math.round(maxD / 60)}min). Review recommended.`);
        for (const seg of siblings) {
          if (!seg.explanation.validationCodes.includes(ValidationCode.SEGMENT_DURATION_IMBALANCE)) {
            seg.explanation.validationCodes.push(ValidationCode.SEGMENT_DURATION_IMBALANCE);
          }
        }
      }
    }

    return segments;
  }

  /* ═══════════════ Readable route name generation ═══════════════ */

  /**
   * Generate a readable route name like "DSI to Galle" from the farthest stop's place name.
   * Falls back to directional label if no place name available.
   */
  private generateRouteName(stops: ResolvedStop[], corridorCode: string): string {
    if (stops.length === 0) return `Route ${corridorCode}`;

    // Find the farthest stop (highest depot distance)
    const farthest = stops.reduce((best, s) => s.depotDistanceKm > best.depotDistanceKm ? s : best, stops[0]);

    // Use place name if available
    if (farthest.placeName) {
      const placeName = this.cleanPlaceName(farthest.placeName);
      return `DSI to ${placeName}`;
    }

    // Fallback: use compass direction
    const bearing = calculateBearing({ lat: 6.0477241, lng: 80.2479661 }, { lat: farthest.lat, lng: farthest.lng });
    const direction = this.bearingToDirection(bearing);
    const distLabel = farthest.depotDistanceKm > 30 ? 'Far' : farthest.depotDistanceKm > 15 ? 'Mid' : 'Near';
    return `DSI ${direction} ${distLabel} (${corridorCode})`;
  }

  private cleanPlaceName(name: string): string {
    // Remove common suffixes and clean up
    return name
      .replace(/\s*(junction|jn|town|city|bus stand|bus stop|railway station)\s*$/i, '')
      .trim();
  }

  private bearingToDirection(bearing: number): string {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(bearing / 45) % 8;
    return dirs[idx];
  }

  private computeContinuityScore(stops: ResolvedStop[]): number {
    if (stops.length < 2) return 1;
    let totalBacktrack = 0;
    for (let i = 1; i < stops.length; i++) {
      if (stops[i].depotDistanceKm > stops[i - 1].depotDistanceKm + 2) {
        totalBacktrack++;
      }
    }
    return Math.max(0, 1 - (totalBacktrack / stops.length));
  }

  /* ═══════════════ Stage I: Validation ═══════════════ */

  private validateSegments(segments: GroupedSegment[], warnings: string[]): void {
    // Global dedup
    const globalSeen = new Set<number>();
    for (const seg of segments) {
      const segSeen = new Set<number>();
      const dedupedStops: ResolvedStop[] = [];
      for (const stop of seg.stops) {
        if (segSeen.has(stop.employeeId) || globalSeen.has(stop.employeeId)) {
          warnings.push(`[VALIDATION:DEDUP] Segment ${seg.segmentCode}: removed duplicate employee #${stop.employeeId}`);
          continue;
        }
        segSeen.add(stop.employeeId);
        globalSeen.add(stop.employeeId);
        dedupedStops.push({ ...stop, stopSequence: dedupedStops.length + 1 });
      }
      seg.stops = dedupedStops;
    }

    for (const seg of segments) {
      if (seg.explanation.qualityScore < 0.3) {
        if (!seg.explanation.validationCodes.includes(ValidationCode.LOW_QUALITY)) {
          seg.explanation.validationCodes.push(ValidationCode.LOW_QUALITY);
        }
        warnings.push(`[VALIDATION:${ValidationCode.LOW_QUALITY}] Segment ${seg.segmentCode}: quality=${seg.explanation.qualityScore}`);
      }
      if (seg.explanation.continuityScore < 0.5) {
        if (!seg.explanation.validationCodes.includes(ValidationCode.EXCESSIVE_BACKTRACKING)) {
          seg.explanation.validationCodes.push(ValidationCode.EXCESSIVE_BACKTRACKING);
        }
        warnings.push(`[VALIDATION:${ValidationCode.EXCESSIVE_BACKTRACKING}] Segment ${seg.segmentCode}: continuity=${seg.explanation.continuityScore}`);
      }
      if (seg.stops.length < this.config.minSegmentOccupancy) {
        if (!seg.explanation.validationCodes.includes(ValidationCode.UNDERFILLED)) {
          seg.explanation.validationCodes.push(ValidationCode.UNDERFILLED);
        }
        warnings.push(`[VALIDATION:${ValidationCode.UNDERFILLED}] Segment ${seg.segmentCode}: ${seg.stops.length} < ${this.config.minSegmentOccupancy}`);
      }
    }

    // Duration imbalance check
    if (segments.length >= 2) {
      const durations = segments.map(s => s.estimatedDurationSeconds).filter(d => d > 0);
      if (durations.length >= 2) {
        const maxD = Math.max(...durations);
        const minD = Math.min(...durations);
        if (maxD / minD > 3) {
          warnings.push(`[VALIDATION:${ValidationCode.SEGMENT_DURATION_IMBALANCE}] shortest=${Math.round(minD / 60)}min, longest=${Math.round(maxD / 60)}min (ratio ${(maxD / minD).toFixed(1)}x)`);
        }
      }
    }

    const issueCount = warnings.filter(w => w.startsWith('[VALIDATION')).length;
    this.logger.log(`[V4] Validation: ${segments.length} segments, ${issueCount} issues`);
  }

  /* ═══════════════ Helpers ═══════════════ */

  private farthestFirstOrder(stops: EnrichedStop[]): ResolvedStop[] {
    const sorted = [...stops].sort((a, b) => b.roadDistanceKm - a.roadDistanceKm);
    return sorted.map((s, i) => ({
      employeeId: s.employeeId, placeId: s.placeId, placeName: s.placeName,
      lat: s.lat, lng: s.lng, stopSequence: i + 1,
      depotDistanceKm: s.roadDistanceKm, depotDurationSeconds: s.roadDurationSeconds,
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
