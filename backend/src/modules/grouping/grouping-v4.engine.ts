import { Logger } from '@nestjs/common';
import { RoutingService } from '../routing/routing.service';
import { LatLng, MatrixEntry, haversineDistance, calculateBearing } from '../routing/routing-provider.interface';

/**
 * V4 Grouping Engine — Enterprise-grade corridor splitting.
 *
 * Improvements over V3:
 *   - Natural cut-point scoring (travel-time gaps, bearing changes, density boundaries)
 *   - Micro-cluster protection (never split inside tight neighborhoods)
 *   - Multi-vehicle corridor support with balanced segments
 *   - Configurable thresholds (max ride time, max stops, cluster radius)
 *   - Explainability metadata per segment
 *   - Validation pass with quality warnings
 *
 * Stages:
 *   A) Pre-bucketing by direction sectors
 *   B) Amazon route matrix intelligence
 *   C) Master corridor chain building (ordered by travel-time adjacency)
 *   D) Natural cut-point analysis + capacity-aware splitting
 *   E) Post-split refinement + micro-cluster protection
 *   F) Consolidation of underfilled segments
 *   G) Stop order optimization + route calculation
 *   H) Validation pass
 */

/* ═══════════════ Config ═══════════════ */

export interface GroupingV4Config {
  /** Max travel time per segment in seconds (default: 5400 = 90 min) */
  maxSegmentDurationSeconds: number;
  /** Max stops per segment (default: 60) */
  maxSegmentStops: number;
  /** Micro-cluster protection radius in km (default: 1.5) */
  clusterProtectionRadiusKm: number;
  /** Minimum cut-point score to allow splitting (0-1, default: 0.3) */
  minCutPointScore: number;
  /** Max group size before forced splitting (default: 80) */
  maxGroupSize: number;
  /** Min occupancy for a viable segment (default: 5) */
  minSegmentOccupancy: number;
  /** Sector angle for pre-bucketing (default: 30°) */
  sectorAngle: number;
  /** Max matrix batch size for Amazon API (default: 25) */
  maxMatrixBatch: number;
  /** Large bucket sliding window size (default: 20) */
  largeBucketWindow: number;
}

const DEFAULT_CONFIG: GroupingV4Config = {
  maxSegmentDurationSeconds: 5400,
  maxSegmentStops: 60,
  clusterProtectionRadiusKm: 1.5,
  minCutPointScore: 0.3,
  maxGroupSize: 80,
  minSegmentOccupancy: 5,
  sectorAngle: 30,
  maxMatrixBatch: 25,
  largeBucketWindow: 20,
};

/* ═══════════════ Public types ═══════════════ */

export interface EmployeeStop {
  employeeId: number;
  placeId?: number;
  lat: number;
  lng: number;
  sourceType: 'employee-direct' | 'place-fallback';
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

export interface SegmentExplanation {
  splitReason: string;
  qualityScore: number;
  continuityScore: number;
  occupancyRatio: number;
  warnings: string[];
  cutPointScore?: number;
  constraintForced?: string;
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
  index: number; // cut AFTER this index in the ordered chain
  score: number; // 0-1, higher = better cut point
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

    // ── Stage B: Matrix enrichment ──
    const { stopToStopMatrices } = await this.enrichWithMatrix(buckets, depot, isAmazon, warnings);
    this.logger.log(`[V4] Stage B: Matrix enrichment complete`);

    // ── Stage C: Master corridor chains ──
    const chains = this.buildRouteChains(buckets, stopToStopMatrices, isAmazon);
    this.logger.log(`[V4] Stage C: ${chains.length} route chains`);

    // ── Stage D: Natural cut-point splitting ──
    const rawSegments = this.splitChainsWithCutPoints(chains, stopToStopMatrices);
    this.logger.log(`[V4] Stage D: ${rawSegments.length} segments after cut-point splitting`);

    // ── Stage E/F: Consolidation ──
    const consolidated = this.consolidateSegments(rawSegments, stopToStopMatrices, depot);
    this.logger.log(`[V4] Stage E/F: ${consolidated.length} consolidated segments`);

    // ── Stage G: Stop order optimization + route calculation ──
    const finalSegments = await this.optimizeAndCalculateRoutes(date, consolidated, depot, isAmazon, warnings);
    this.logger.log(`[V4] Stage G: ${finalSegments.length} final segments with routes`);

    // ── Stage H: Validation pass ──
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
        warnings.push(`Bucket ${code}: ${stops.length} stops via sliding-window sub-batching.`);
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

  /* ═══════════════ Stage D: Natural cut-point splitting ═══════════════ */

  private splitChainsWithCutPoints(
    chains: RouteChain[],
    matrices: Map<string, MatrixEntry[][]>,
  ): RawSegment[] {
    const segments: RawSegment[] = [];

    for (const chain of chains) {
      const n = chain.totalEmployees;

      if (n <= this.config.maxGroupSize && n <= this.config.maxSegmentStops) {
        // Check if duration exceeds max
        const totalDuration = chain.stops.reduce((s, x) => s + x.roadDurationSeconds, 0);
        if (totalDuration <= this.config.maxSegmentDurationSeconds || n <= this.config.minSegmentOccupancy) {
          segments.push({
            corridorCode: chain.corridorCode,
            stops: chain.stops,
            segmentType: 'GROUP',
            routingSource: chain.routingSource,
            splitReason: 'single_corridor_within_limits',
          });
          continue;
        }
      }

      // Need to split — compute cut points
      const s2s = matrices.get(chain.corridorCode);
      const cutPoints = this.computeCutPoints(chain.stops, s2s);

      // Determine how many segments needed
      const neededByCapacity = Math.ceil(n / this.config.maxGroupSize);
      const totalDuration = this.estimateChainDuration(chain.stops, s2s);
      const neededByTime = Math.ceil(totalDuration / this.config.maxSegmentDurationSeconds);
      const neededByStops = Math.ceil(n / this.config.maxSegmentStops);
      const numSegments = Math.max(neededByCapacity, neededByTime, neededByStops, 2);

      // Select best cut points
      const selectedCuts = this.selectBestCutPoints(cutPoints, numSegments - 1, chain.stops);

      // Sort cut indices ascending
      const cutIndices = selectedCuts.map(c => c.index).sort((a, b) => a - b);

      // Create segments from cuts
      let prevIdx = 0;
      for (let i = 0; i <= cutIndices.length; i++) {
        const endIdx = i < cutIndices.length ? cutIndices[i] + 1 : chain.stops.length;
        const segStops = chain.stops.slice(prevIdx, endIdx);
        const cut = i > 0 ? selectedCuts.find(c => c.index === cutIndices[i - 1]) : undefined;

        if (segStops.length > 0) {
          segments.push({
            corridorCode: chain.corridorCode,
            stops: segStops,
            segmentType: 'SPLIT',
            routingSource: chain.routingSource,
            splitReason: cut ? `cut_at_${cut.reason}` : 'corridor_start',
            cutPointScore: cut?.score,
            constraintForced: this.determineConstraint(neededByCapacity, neededByTime, neededByStops),
          });
        }
        prevIdx = endIdx;
      }
    }

    return segments;
  }

  /** Compute cut-point scores for each adjacent boundary in the ordered chain */
  private computeCutPoints(stops: EnrichedStop[], s2s?: MatrixEntry[][] | null): CutPoint[] {
    const cutPoints: CutPoint[] = [];
    if (stops.length < 3) return cutPoints;

    // Compute stats for normalization
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

      // Is this a micro-cluster boundary?
      const isClusterBoundary = distGap > this.config.clusterProtectionRadiusKm;
      const isDensityDrop = distGap > avgDistGap * 2;

      // Check if cutting here would split a micro-cluster
      const insideMicroCluster = !isClusterBoundary && distGap < this.config.clusterProtectionRadiusKm * 0.5;

      // Score components (0-1 each)
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
        index: i,
        score,
        reason,
        travelTimeGap: ttGap,
        distanceGap: distGap,
        bearingChange: normalizedBearing,
        densityDrop: isDensityDrop,
        clusterBoundary: isClusterBoundary,
      });
    }

    return cutPoints;
  }

  /** Select the best N cut points, respecting micro-cluster protection */
  private selectBestCutPoints(cutPoints: CutPoint[], needed: number, stops: EnrichedStop[]): CutPoint[] {
    if (cutPoints.length === 0 || needed <= 0) return [];

    // Sort by score descending
    const sorted = [...cutPoints].sort((a, b) => b.score - a.score);

    const selected: CutPoint[] = [];
    for (const cp of sorted) {
      if (selected.length >= needed) break;

      // Skip if below minimum score and not forced by constraint
      if (cp.score < this.config.minCutPointScore && selected.length > 0) continue;

      // Ensure minimum spacing between cuts (at least minSegmentOccupancy apart)
      const tooClose = selected.some(s => Math.abs(s.index - cp.index) < this.config.minSegmentOccupancy);
      if (tooClose) continue;

      selected.push(cp);
    }

    // If we couldn't find enough good cut points, fall back to evenly spaced
    if (selected.length < needed) {
      const step = Math.floor(stops.length / (needed + 1));
      for (let i = 1; i <= needed && selected.length < needed; i++) {
        const idx = i * step - 1;
        if (idx >= 0 && idx < stops.length - 1) {
          const existing = selected.find(s => Math.abs(s.index - idx) < this.config.minSegmentOccupancy);
          if (!existing) {
            selected.push({
              index: idx, score: 0.1, reason: 'even_fallback',
              travelTimeGap: 0, distanceGap: 0, bearingChange: 0,
              densityDrop: false, clusterBoundary: false,
            });
          }
        }
      }
    }

    return selected;
  }

  private estimateChainDuration(stops: EnrichedStop[], s2s?: MatrixEntry[][] | null): number {
    let total = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      total += s2s?.[i]?.[i + 1]?.duration_seconds ?? (haversineDistance(stops[i], stops[i + 1]) * 120);
    }
    return total;
  }

  private determineConstraint(cap: number, time: number, stops: number): string | undefined {
    if (cap >= time && cap >= stops) return 'capacity';
    if (time >= cap && time >= stops) return 'max_ride_time';
    if (stops >= cap && stops >= time) return 'max_stops';
    return undefined;
  }

  /* ═══════════════ Stage E/F: Consolidation ═══════════════ */

  private consolidateSegments(
    segments: RawSegment[],
    matrices: Map<string, MatrixEntry[][]>,
    depot: LatLng,
  ): RawSegment[] {
    if (segments.length <= 1) return segments;

    const { minSegmentOccupancy, maxGroupSize } = this.config;

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

  /* ═══════════════ Stage G: Stop order optimization + routes ═══════════════ */

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
          // Map optimized waypoints back and deduplicate by employeeId
          const seen = new Set<number>();
          const rawStops: ResolvedStop[] = [];
          for (const wp of optimized) {
            const orig = (wp.original_index >= 0 && wp.original_index < seg.stops.length)
              ? seg.stops[wp.original_index]
              : null;
            if (!orig || seen.has(orig.employeeId)) continue;
            seen.add(orig.employeeId);
            rawStops.push({
              employeeId: orig.employeeId, placeId: orig.placeId,
              lat: orig.lat, lng: orig.lng, stopSequence: rawStops.length + 1,
              depotDistanceKm: orig.roadDistanceKm, depotDurationSeconds: orig.roadDurationSeconds,
            });
          }
          // If dedup dropped entries, add any missing employees from seg.stops
          for (const s of seg.stops) {
            if (!seen.has(s.employeeId)) {
              seen.add(s.employeeId);
              rawStops.push({
                employeeId: s.employeeId, placeId: s.placeId,
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

    // Compute quality scores
    const maxCap = Math.max(this.vehicleConfig.vanCapacity, this.vehicleConfig.busCapacity);
    const occupancyRatio = orderedStops.length / maxCap;
    const continuityScore = this.computeContinuityScore(orderedStops);
    const qualityScore = (continuityScore * 0.5) + (Math.min(occupancyRatio, 1) * 0.3) + (estimatedDurationSeconds < this.config.maxSegmentDurationSeconds ? 0.2 : 0);

    const segWarnings: string[] = [];
    if (estimatedDurationSeconds > this.config.maxSegmentDurationSeconds) {
      segWarnings.push(`Duration ${Math.round(estimatedDurationSeconds / 60)}min exceeds max ${Math.round(this.config.maxSegmentDurationSeconds / 60)}min`);
    }
    if (orderedStops.length > this.config.maxSegmentStops) {
      segWarnings.push(`${orderedStops.length} stops exceeds max ${this.config.maxSegmentStops}`);
    }

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
      explanation: {
        splitReason: seg.splitReason,
        qualityScore: Math.round(qualityScore * 100) / 100,
        continuityScore: Math.round(continuityScore * 100) / 100,
        occupancyRatio: Math.round(occupancyRatio * 100) / 100,
        warnings: segWarnings,
        cutPointScore: seg.cutPointScore,
        constraintForced: seg.constraintForced,
      },
    };
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

  /* ═══════════════ Stage H: Validation ═══════════════ */

  private validateSegments(segments: GroupedSegment[], warnings: string[]): void {
    // ── Global dedup: ensure no employee appears in more than one segment ──
    const globalSeen = new Set<number>();
    for (const seg of segments) {
      const segSeen = new Set<number>();
      const dedupedStops: ResolvedStop[] = [];
      for (const stop of seg.stops) {
        if (segSeen.has(stop.employeeId) || globalSeen.has(stop.employeeId)) {
          warnings.push(`[VALIDATION] Segment ${seg.segmentCode}: removed duplicate employee #${stop.employeeId}`);
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
        warnings.push(`[VALIDATION] Segment ${seg.segmentCode}: low quality score (${seg.explanation.qualityScore}). Review recommended.`);
      }
      if (seg.explanation.continuityScore < 0.5) {
        warnings.push(`[VALIDATION] Segment ${seg.segmentCode}: excessive backtracking detected (continuity=${seg.explanation.continuityScore}).`);
      }
      if (seg.stops.length < this.config.minSegmentOccupancy) {
        warnings.push(`[VALIDATION] Segment ${seg.segmentCode}: underfilled (${seg.stops.length} < ${this.config.minSegmentOccupancy}).`);
      }
      if (seg.estimatedDurationSeconds > this.config.maxSegmentDurationSeconds * 1.2) {
        warnings.push(`[VALIDATION] Segment ${seg.segmentCode}: significantly exceeds max duration.`);
      }
    }

    // Check for highly imbalanced segment durations
    if (segments.length >= 2) {
      const durations = segments.map(s => s.estimatedDurationSeconds);
      const maxD = Math.max(...durations);
      const minD = Math.min(...durations);
      if (maxD > 0 && minD > 0 && maxD / minD > 3) {
        warnings.push(`[VALIDATION] Highly imbalanced segment durations: shortest=${Math.round(minD / 60)}min, longest=${Math.round(maxD / 60)}min.`);
      }
    }

    this.logger.log(`[V4] Validation: ${segments.length} segments, ${warnings.filter(w => w.startsWith('[VALIDATION]')).length} issues flagged`);
  }

  /* ═══════════════ Helpers ═══════════════ */

  private farthestFirstOrder(stops: EnrichedStop[]): ResolvedStop[] {
    const sorted = [...stops].sort((a, b) => b.roadDistanceKm - a.roadDistanceKm);
    return sorted.map((s, i) => ({
      employeeId: s.employeeId, placeId: s.placeId,
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
