import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  RouteGroupRun, GeneratedRouteGroup, GeneratedRouteGroupMember, AssignmentException,
  GroupVehicleAssignment,
} from './grouping.entity';
import { DailyRun, DailyRunStatus } from '../daily-lock/daily-run.entity';
import { TransportRequest, TransportRequestEmployee } from '../transport-requests/transport-request.entity';
import { Employee } from '../employees/employee.entity';
import { Place } from '../places/place.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { GroupStatus, VehicleType, RequestStatus } from '../../common/enums';
import { RoutingService } from '../routing/routing.service';
import { LatLng } from '../routing/routing-provider.interface';
import { GroupingV3Engine, EmployeeStop, UnresolvedEmployee, VehicleConfig } from './grouping-v3.engine';
import { GroupingV4Engine, GroupingV4Config, SegmentExplanation, ValidationCode } from './grouping-v4.engine';

@Injectable()
export class GroupingService {
  private readonly logger = new Logger(GroupingService.name);
  private readonly vehicleConfig: VehicleConfig;

  /** Runtime overflow defaults — populated from env in constructor */
  private typeOverflowDefaults: Record<string, number> = { VAN: 0, BUS: 0 };

  /** Get effective capacity for a vehicle: capacity + (vehicle.soft_overflow if set, else env default) */
  getEffectiveCapacity(v: { capacity: number; soft_overflow?: number; type?: string }): number {
    const overflow = (v.soft_overflow != null && v.soft_overflow > 0)
      ? v.soft_overflow
      : (this.typeOverflowDefaults[(v.type || '').toUpperCase()] ?? 0);
    return v.capacity + overflow;
  }

  /** Get the soft overflow allowance for a vehicle */
  getOverflowAllowance(v: { capacity: number; soft_overflow?: number; type?: string }): number {
    return (v.soft_overflow != null && v.soft_overflow > 0)
      ? v.soft_overflow
      : (this.typeOverflowDefaults[(v.type || '').toUpperCase()] ?? 0);
  }

  constructor(
    @InjectRepository(RouteGroupRun) private runRepo: Repository<RouteGroupRun>,
    @InjectRepository(GeneratedRouteGroup) private groupRepo: Repository<GeneratedRouteGroup>,
    @InjectRepository(GeneratedRouteGroupMember) private memberRepo: Repository<GeneratedRouteGroupMember>,
    @InjectRepository(AssignmentException) private exceptionRepo: Repository<AssignmentException>,
    @InjectRepository(GroupVehicleAssignment) private gvaRepo: Repository<GroupVehicleAssignment>,
    @InjectRepository(TransportRequest) private reqRepo: Repository<TransportRequest>,
    @InjectRepository(TransportRequestEmployee) private reqEmpRepo: Repository<TransportRequestEmployee>,
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
    @InjectRepository(Place) private placeRepo: Repository<Place>,
    @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(DailyRun) private dailyRunRepo: Repository<DailyRun>,
    private dataSource: DataSource,
    private config: ConfigService,
    private routing: RoutingService,
  ) {
    this.vehicleConfig = {
      vanCapacity: config.get<number>('vehicle.vanCapacity', 15),
      busCapacity: config.get<number>('vehicle.busCapacity', 52),
      vanSoftOverflow: config.get<number>('vehicle.vanSoftOverflow', 0),
      busSoftOverflow: config.get<number>('vehicle.busSoftOverflow', 0),
      minVanOccupancy: config.get<number>('vehicle.minVanOccupancy', 5),
      minBusOccupancy: config.get<number>('vehicle.minBusOccupancy', 15),
    };
    // Populate overflow defaults from env config (VAN_SOFT_OVERFLOW, BUS_SOFT_OVERFLOW)
    this.typeOverflowDefaults = {
      VAN: this.vehicleConfig.vanSoftOverflow,
      BUS: this.vehicleConfig.busSoftOverflow,
    };
  }

  /**
   * V3: Run grouping for a locked daily run.
   * DailyRun is the TRUE identity — request_id is NOT used as identity.
   */
  async runDailyGrouping(date: string, userId: number): Promise<RouteGroupRun & { daily_run_id: number }> {
    if (!date) throw new BadRequestException('Date is required');

    // ── Resolve DailyRun as the primary identity ──
    const dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: date as any } });
    if (!dailyRun) {
      throw new BadRequestException(`No daily run exists for ${date}. Lock the date first.`);
    }
    if (dailyRun.status !== DailyRunStatus.LOCKED && dailyRun.status !== DailyRunStatus.GROUPED) {
      throw new BadRequestException(`Daily run for ${date} is in status "${dailyRun.status}". It must be LOCKED to run grouping.`);
    }

    // Find all DAILY_LOCKED / TA_PROCESSING requests for this date
    const lockedRequests = await this.reqRepo.find({
      where: { request_date: date as any, status: In([RequestStatus.DAILY_LOCKED, RequestStatus.TA_PROCESSING]) },
    });
    if (lockedRequests.length === 0) {
      throw new BadRequestException(`No locked requests found for ${date}. Lock the daily batch first.`);
    }

    const requestIds = lockedRequests.map(r => r.id);
    const departmentIds = [...new Set(lockedRequests.map(r => r.department_id))];
    this.logger.log(`V3 Daily grouping for ${date}: ${requestIds.length} requests, ${departmentIds.length} departments, dailyRunId=${dailyRun.id}`);

    // Mark all as TA_PROCESSING — batch update instead of N updates
    const dailyLockedIds = lockedRequests.filter(r => r.status === RequestStatus.DAILY_LOCKED).map(r => r.id);
    if (dailyLockedIds.length > 0) {
      await this.reqRepo.update(dailyLockedIds, { status: RequestStatus.TA_PROCESSING });
    }

    // Collect ALL employees across all requests
    const allReqEmps = await this.reqEmpRepo.find({ where: { request_id: In(requestIds) } });
    if (!allReqEmps.length) throw new NotFoundException('No employees in any locked request for this date');

    const uniqueEmployeeIds = [...new Set(allReqEmps.map(re => re.employee_id))];
    const employees = await this.empRepo.findByIds(uniqueEmployeeIds);

    // Batch-load all places needed for coordinate resolution
    const placeIds = [...new Set(employees.map(e => e.place_id).filter(Boolean))] as number[];
    const places = placeIds.length > 0 ? await this.placeRepo.findByIds(placeIds) : [];
    const placeMap = new Map(places.map(p => [p.id, p]));

    // Resolve coordinates — no per-employee DB queries
    const stops: EmployeeStop[] = [];
    const unresolvedList: UnresolvedEmployee[] = [];

    for (const emp of employees) {
      let lat = emp.lat ? Number(emp.lat) : null;
      let lng = emp.lng ? Number(emp.lng) : null;
      const placeId = emp.place_id;

      if (!lat || !lng || lat === 0 || lng === 0) {
        if (placeId) {
          const place = placeMap.get(placeId);
          if (place) {
            lat = Number(place.latitude);
            lng = Number(place.longitude);
          }
        }
      }

      if (!lat || !lng || lat === 0 || lng === 0 || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        unresolvedList.push({
          employeeId: emp.id,
          employeeName: emp.full_name,
          empNo: emp.emp_no || String(emp.id),
          reason: `No resolvable coordinates for ${emp.full_name} (${emp.emp_no || emp.id})`,
        });
        continue;
      }

      stops.push({ employeeId: emp.id, placeId: placeId ?? undefined, lat, lng, sourceType: lat === Number(emp.lat) ? 'employee-direct' : 'place-fallback' });
    }

    // ── Run V4 engine (enterprise-grade with natural cut-point splitting) ──
    const v4Config: Partial<GroupingV4Config> = {
      maxSegmentDurationSeconds: this.config.get<number>('grouping.maxSegmentDurationSeconds', 5400),
      maxSegmentStops: this.config.get<number>('grouping.maxSegmentStops', 60),
      clusterProtectionRadiusKm: this.config.get<number>('grouping.clusterProtectionRadiusKm', 1.5),
      minCutPointScore: this.config.get<number>('grouping.minCutPointScore', 0.3),
      maxGroupSize: this.config.get<number>('grouping.maxGroupSize', 80),
    };
    const engine = new GroupingV4Engine(this.routing, this.vehicleConfig, v4Config);
    const result = await engine.run(date, stops, unresolvedList);

    // Get available vehicles for recommendations
    const vehicles = await this.vehicleRepo.find({ where: { is_active: true }, order: { capacity: 'DESC' } });

    // ── Create run record — linked to DailyRun only ──
    const lastRun = await this.runRepo.findOne({
      where: { daily_run_id: dailyRun.id },
      order: { run_number: 'DESC' },
    });
    const runNumber = (lastRun?.run_number || 0) + 1;

    const run = await this.runRepo.save(this.runRepo.create({
      daily_run_id: dailyRun.id,
      run_number: runNumber,
      initiated_by_user_id: userId,
      total_groups: result.segments.length,
      total_employees: result.totalResolved,
      unresolved_count: result.totalUnresolved,
      routing_source: result.routingSource,
      routing_warning: result.warnings.length > 0 ? result.warnings.join('; ') : undefined,
      parameters: {
        date,
        dailyRunId: dailyRun.id,
        requestIds,
        requestCount: requestIds.length,
        departmentCount: departmentIds.length,
        engine: 'V4',
        routingProvider: result.routingSource,
        vehicleConfig: this.vehicleConfig,
        groupingConfig: v4Config,
      },
      summary: `V4 Daily run [${date}]: ${result.segments.length} groups, ${result.totalResolved} employees from ${requestIds.length} requests (${departmentIds.length} depts). Routing: ${result.routingSource}. ${result.totalUnresolved} unresolved.`,
    }));

    // ── Update DailyRun ──
    await this.dailyRunRepo.update(dailyRun.id, {
      status: DailyRunStatus.GROUPED,
      included_request_ids: requestIds,
      request_count: requestIds.length,
      department_count: departmentIds.length,
      total_employees: result.totalResolved,
      unresolved_count: result.totalUnresolved,
      routing_source: result.routingSource,
      routing_warning: result.warnings.length > 0 ? result.warnings.join('; ') : undefined,
      grouping_summary: run.summary,
      grouped_at: new Date(),
      total_groups: result.segments.length,
      latest_run_id: run.id,
    });

    // Save unresolved exceptions — batch insert
    if (result.unresolved.length > 0) {
      const exceptionEntities = result.unresolved.map(u => this.exceptionRepo.create({
        run_id: run.id,
        employee_id: u.employeeId,
        exception_type: 'UNRESOLVED_LOCATION',
        description: u.reason,
      }));
      await this.exceptionRepo.save(exceptionEntities);
    }

    // Save groups and members — batch per group, batch members
    for (const seg of result.segments) {
      const recommendation = this.recommendVehicle(seg.stops.length, vehicles);

      const groupEntity = this.groupRepo.create({
        run_id: run.id,
        daily_run_id: dailyRun.id,
        group_code: seg.segmentCode,
        corridor_code: seg.corridorCode,
        center_lat: seg.centerLat,
        center_lng: seg.centerLng,
        employee_count: seg.stops.length,
        status: GroupStatus.PENDING,
        recommended_vehicle_id: recommendation.vehicleId ?? undefined,
        overflow_allowed: recommendation.overflowNeeded,
        overflow_count: recommendation.overflowCount,
        recommendation_reason: recommendation.reason,
        estimated_distance_km: seg.estimatedDistanceKm,
        estimated_duration_seconds: seg.estimatedDurationSeconds != null ? Math.round(seg.estimatedDurationSeconds) : undefined,
        route_geometry: seg.routeGeometry ?? undefined,
        routing_source: seg.routingSource,
        corridor_label: `Direction ${seg.corridorCode}`,
        cluster_note: `${seg.corridorCode}: ${seg.stops.length} employees, ${seg.stops[0]?.depotDistanceKm.toFixed(1)}–${seg.stops[seg.stops.length - 1]?.depotDistanceKm.toFixed(1)} km from depot [${seg.routingSource}]${(seg as any).explanation ? ` | quality=${(seg as any).explanation.qualityScore} split=${(seg as any).explanation.splitReason}` : ''}`,
      });
      const group = await this.groupRepo.save(groupEntity);

      // Batch-insert members — deduplicate by employee_id to prevent corruption
      const seenEmpIds = new Set<number>();
      const memberEntities = seg.stops
        .filter(stop => {
          if (seenEmpIds.has(stop.employeeId)) {
            this.logger.warn(`[Persist] Skipping duplicate employee #${stop.employeeId} in group ${group.group_code}`);
            return false;
          }
          seenEmpIds.add(stop.employeeId);
          return true;
        })
        .map((stop, idx) => this.memberRepo.create({
          generated_group_id: group.id,
          employee_id: stop.employeeId,
          place_id: stop.placeId ?? undefined,
          lat_snapshot: stop.lat,
          lng_snapshot: stop.lng,
          pickup_sequence: idx + 1,
          depot_distance_km: stop.depotDistanceKm,
          depot_duration_seconds: stop.depotDurationSeconds != null ? Math.round(stop.depotDurationSeconds) : undefined,
        }));
      // Update employee_count to reflect actual unique members
      if (memberEntities.length !== seg.stops.length) {
        await this.groupRepo.update(group.id, { employee_count: memberEntities.length });
      }
      await this.memberRepo.save(memberEntities);
    }

    return { ...run, daily_run_id: dailyRun.id };
  }

  /** Regenerate a run */
  async regenerateRun(runId: number, userId: number): Promise<RouteGroupRun> {
    const oldRun = await this.runRepo.findOne({ where: { id: runId } });
    if (!oldRun) throw new NotFoundException(`Run #${runId} not found`);

    if (oldRun.daily_run_id) {
      const dailyRun = await this.dailyRunRepo.findOne({ where: { id: oldRun.daily_run_id } });
      if (dailyRun) {
        const dateStr = typeof dailyRun.run_date === 'string' ? dailyRun.run_date : (dailyRun.run_date as any)?.toISOString?.()?.split('T')[0];
        if (dateStr) return this.runDailyGrouping(dateStr, userId);
      }
    }

    const params = oldRun.parameters as any;
    const date = params?.date;
    if (!date) throw new BadRequestException('Cannot determine date from run');
    return this.runDailyGrouping(date, userId);
  }

  /**
   * V3: Get latest daily run by date.
   * Uses DailyRun.latest_run_id as the PRIMARY retrieval path.
   */
  async getLatestDailyRun(date: string): Promise<any> {
    const dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: date as any } });
    if (!dailyRun) {
      throw new NotFoundException(`No daily run found for ${date}`);
    }

    let run: RouteGroupRun | null = null;
    if (dailyRun.latest_run_id) {
      run = await this.runRepo.findOne({ where: { id: dailyRun.latest_run_id } });
    }

    if (!run) {
      run = await this.runRepo.findOne({
        where: { daily_run_id: dailyRun.id },
        order: { run_number: 'DESC' },
      });
      if (run && dailyRun.latest_run_id !== run.id) {
        await this.dailyRunRepo.update(dailyRun.id, { latest_run_id: run.id });
        this.logger.warn(`Healed stale latest_run_id for daily run ${dailyRun.id}: ${dailyRun.latest_run_id} -> ${run.id}`);
      }
    }

    if (!run) {
      return {
        daily_run_id: dailyRun.id,
        daily_run_status: dailyRun.status,
        request_count: dailyRun.request_count,
        department_count: dailyRun.department_count,
        total_employees: dailyRun.total_employees,
        unresolved_count: dailyRun.unresolved_count,
        routing_source: dailyRun.routing_source,
        routing_warning: dailyRun.routing_warning,
        total_groups: 0,
        groups: [],
        message: `Daily run exists for ${date} but no grouping has been run yet.`,
      };
    }

    const runWithGroups = await this.loadRunWithGroups(run);

    return {
      ...runWithGroups,
      daily_run_id: dailyRun.id,
      daily_run_status: dailyRun.status,
      request_count: dailyRun.request_count,
      department_count: dailyRun.department_count,
    };
  }

  /** Get DailyRun entity for a date */
  async getDailyRun(date: string): Promise<DailyRun | null> {
    return this.dailyRunRepo.findOne({ where: { run_date: date as any } });
  }

  /**
   * Load run with groups — optimized: batch-load employees and vehicles
   * to eliminate N+1 queries per group.
   */
  private async loadRunWithGroups(run: RouteGroupRun): Promise<RouteGroupRun & { groups: any[] }> {
    const groups = await this.groupRepo.find({
      where: { run_id: run.id },
      order: { group_code: 'ASC' },
    });

    if (groups.length === 0) return { ...run, groups: [] };

    // Batch-load ALL members for this run's groups
    const groupIds = groups.map(g => g.id);
    const allMembers = await this.memberRepo.find({
      where: { generated_group_id: In(groupIds) },
      order: { pickup_sequence: 'ASC' },
    });

    // Batch-load ALL employees referenced by members
    const allEmpIds = [...new Set(allMembers.map(m => m.employee_id))];
    const allEmps = allEmpIds.length > 0 ? await this.empRepo.findByIds(allEmpIds) : [];
    const empMap = new Map(allEmps.map(e => [e.id, e]));

    // Batch-load ALL vehicles (assigned + all active for capacity truth)
    const assignedVehicleIds = [...new Set(groups.map(g => g.assigned_vehicle_id).filter(Boolean))] as number[];
    const allVehicles = assignedVehicleIds.length > 0 ? await this.vehicleRepo.findByIds(assignedVehicleIds) : [];
    const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));

    // Load all active vehicles for capacity truth computation
    const activeVehicles = await this.vehicleRepo.find({ where: { is_active: true } });
    const maxDriverBackedEffCap = Math.max(
      ...activeVehicles.filter(v => !!v.driver_name).map(v => this.getEffectiveCapacity(v)),
      0,
    );
    const maxAnyEffCap = Math.max(
      ...activeVehicles.map(v => this.getEffectiveCapacity(v)),
      0,
    );

    // Group members by group_id for fast lookup
    const membersByGroup = new Map<number, typeof allMembers>();
    for (const m of allMembers) {
      if (!membersByGroup.has(m.generated_group_id)) membersByGroup.set(m.generated_group_id, []);
      membersByGroup.get(m.generated_group_id)!.push(m);
    }

    const groupsWithMembers = groups.map(g => {
      const members = membersByGroup.get(g.id) || [];
      const vehicle = g.assigned_vehicle_id ? vehicleMap.get(g.assigned_vehicle_id) : undefined;

      const membersWithNames = members.map(m => ({
        ...m,
        stop_sequence: m.pickup_sequence,
        full_name: empMap.get(m.employee_id)?.full_name || `Employee #${m.employee_id}`,
        emp_no: empMap.get(m.employee_id)?.emp_no || '',
      }));

      // Capacity truth fields — informational only, NOT used to block assignment
      const empCount = g.employee_count;
      const fitsSingleVehicle = empCount <= maxAnyEffCap;
      const fitsSingleDriverBackedVehicle = empCount <= maxDriverBackedEffCap;

      // Determine assignment info (informational — multi-vehicle is always allowed)
      let assignmentBlockReason: string | undefined;
      if (fitsSingleVehicle && !fitsSingleDriverBackedVehicle) {
        assignmentBlockReason = 'no_driver_backed_vehicle';
      }

      return {
        ...g,
        members: membersWithNames,
        assigned_vehicle_reg: vehicle?.registration_no,
        driver_name: vehicle?.driver_name,
        driver_phone: vehicle?.driver_phone,
        estimated_distance_km: g.estimated_distance_km,
        estimated_duration_seconds: g.estimated_duration_seconds,
        route_geometry: g.route_geometry,
        routing_source: g.routing_source,
        corridor_label: g.corridor_label,
        corridor_code: g.corridor_code,
        // Capacity truth — informational. Multi-vehicle assignment is always an option.
        fits_single_vehicle: fitsSingleVehicle,
        fits_single_vehicle_with_overflow: fitsSingleVehicle,
        requires_split: false, // Never force split — officer chooses vehicle combination
        assignment_block_reason: assignmentBlockReason,
      };
    });

    return { ...run, groups: groupsWithMembers };
  }

  /**
   * Assign vehicle — driver auto-derived from vehicle's permanent driver.
   * Uses pessimistic lock to prevent double-assign races.
   * Validates: duplicate vehicle per daily run, capacity + overflow from env config.
   */
  async assignVehicle(groupId: number, vehicleId: number): Promise<any> {
    const vehicle = await this.vehicleRepo.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (!vehicle.driver_name) {
      throw new BadRequestException(
        `Vehicle ${vehicle.registration_no} has no permanent driver assigned. Assign a driver in Vehicle Management first.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const mgr = queryRunner.manager;

      const group = await mgr.findOne(GeneratedRouteGroup, {
        where: { id: groupId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!group) throw new NotFoundException('Group not found');
      if (group.status === GroupStatus.CONFIRMED) {
        throw new BadRequestException('Group is already confirmed. Unassign first to reassign.');
      }

      // ── Rule 1: Duplicate vehicle check — one vehicle per daily run ──
      if (group.daily_run_id) {
        const existing = await mgr.findOne(GeneratedRouteGroup, {
          where: { daily_run_id: group.daily_run_id, run_id: group.run_id, assigned_vehicle_id: vehicleId },
        });
        if (existing && existing.id !== groupId) {
          throw new BadRequestException('This vehicle is already assigned to another group for this day.');
        }
      }

      // ── Rule 3: Capacity + overflow validation from env config ──
      const effCap = this.getEffectiveCapacity(vehicle);
      if (group.employee_count > effCap) {
        const overflow = this.getOverflowAllowance(vehicle);
        throw new BadRequestException(
          `Group size (${group.employee_count}) exceeds allowed capacity (${vehicle.capacity} + ${overflow} overflow = ${effCap}). Overflow limit reached. Split the group or use another vehicle.`,
        );
      }

      const overflowCount = Math.max(0, group.employee_count - vehicle.capacity);

      await mgr.update(GeneratedRouteGroup, groupId, {
        assigned_vehicle_id: vehicleId,
        assigned_driver_id: undefined,
        status: GroupStatus.CONFIRMED,
        overflow_allowed: overflowCount > 0,
        overflow_count: overflowCount,
      });

      if (group.daily_run_id) {
        const dailyRun = await mgr.findOne(DailyRun, { where: { id: group.daily_run_id } });
        if (dailyRun && dailyRun.status === DailyRunStatus.GROUPED) {
          await mgr.update(DailyRun, dailyRun.id, { status: DailyRunStatus.ASSIGNING });
        }
        if (dailyRun) {
          const allGroups = await mgr.find(GeneratedRouteGroup, {
            where: { daily_run_id: dailyRun.id, run_id: group.run_id },
          });
          const allConfirmed = allGroups.every(g => g.id === groupId || g.status === GroupStatus.CONFIRMED);
          if (allConfirmed) {
            await mgr.update(DailyRun, dailyRun.id, {
              status: DailyRunStatus.READY,
              total_groups: allGroups.length,
            });
          }
        }
      }

      await queryRunner.commitTransaction();

      return {
        ...(await this.groupRepo.findOne({ where: { id: groupId } }))!,
        assigned_vehicle_reg: vehicle.registration_no,
        driver_name: vehicle.driver_name,
        driver_phone: vehicle.driver_phone || undefined,
        driver_license_no: vehicle.driver_license_no || undefined,
        has_permanent_driver: true,
        overflow_used: overflowCount > 0,
        overflow_count: overflowCount,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Unassign a confirmed group — revert to PENDING, clear vehicle assignment.
   * Only allowed when DailyRun is not yet DISPATCHED or CLOSED.
   */
  async unassignVehicle(groupId: number): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const mgr = queryRunner.manager;

      const group = await mgr.findOne(GeneratedRouteGroup, {
        where: { id: groupId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!group) throw new NotFoundException('Group not found');
      if (group.status !== GroupStatus.CONFIRMED) {
        throw new BadRequestException('Group is not confirmed — nothing to unassign.');
      }

      if (group.daily_run_id) {
        const dailyRun = await mgr.findOne(DailyRun, { where: { id: group.daily_run_id } });
        if (dailyRun && [DailyRunStatus.DISPATCHED, DailyRunStatus.CLOSED].includes(dailyRun.status)) {
          throw new BadRequestException(`Cannot unassign — daily run is already ${dailyRun.status}.`);
        }
        if (dailyRun && dailyRun.status === DailyRunStatus.READY) {
          await mgr.update(DailyRun, dailyRun.id, { status: DailyRunStatus.ASSIGNING });
        }
      }

      await mgr.update(GeneratedRouteGroup, groupId, {
        assigned_vehicle_id: undefined as any,
        assigned_driver_id: undefined as any,
        status: GroupStatus.PENDING,
      });

      await queryRunner.commitTransaction();

      return { id: groupId, status: 'PENDING', unassigned: true };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Undo a split — merge sub-groups back into one parent group.
   */
  async undoSplit(subGroupId: number): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const mgr = queryRunner.manager;

      const subGroup = await mgr.findOne(GeneratedRouteGroup, {
        where: { id: subGroupId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!subGroup) throw new NotFoundException('Sub-group not found');

      const vMatch = subGroup.group_code.match(/^(.+)-V\d+$/);
      if (!vMatch) {
        throw new BadRequestException('This group was not created by a split operation (no -V suffix).');
      }
      const baseCode = vMatch[1];

      if (subGroup.daily_run_id) {
        const dailyRun = await mgr.findOne(DailyRun, { where: { id: subGroup.daily_run_id } });
        if (dailyRun && [DailyRunStatus.DISPATCHED, DailyRunStatus.CLOSED].includes(dailyRun.status)) {
          throw new BadRequestException(`Cannot undo split — daily run is already ${dailyRun.status}.`);
        }
      }

      const allGroups = await mgr.find(GeneratedRouteGroup, {
        where: { run_id: subGroup.run_id },
      });
      const siblings = allGroups.filter(g => g.group_code.startsWith(baseCode + '-V'));

      if (siblings.length < 2) {
        throw new BadRequestException('No sibling sub-groups found for this split.');
      }

      // Lock all siblings
      for (const sib of siblings) {
        await mgr.findOne(GeneratedRouteGroup, {
          where: { id: sib.id },
          lock: { mode: 'pessimistic_write' },
        });
      }

      // Batch-load all members from all siblings
      const siblingIds = siblings.map(s => s.id);
      const allMembers = await mgr.find(GeneratedRouteGroupMember, {
        where: { generated_group_id: In(siblingIds) },
        order: { pickup_sequence: 'ASC' },
      });

      const totalEmpCount = allMembers.length;
      const centerLat = allMembers.reduce((s, m) => s + Number(m.lat_snapshot), 0) / totalEmpCount;
      const centerLng = allMembers.reduce((s, m) => s + Number(m.lng_snapshot), 0) / totalEmpCount;

      const maxDistance = Math.max(...siblings.map(s => Number(s.estimated_distance_km) || 0));
      const maxDuration = Math.max(...siblings.map(s => Number(s.estimated_duration_seconds) || 0));

      const parent = mgr.create(GeneratedRouteGroup, {
        run_id: subGroup.run_id,
        daily_run_id: subGroup.daily_run_id,
        group_code: baseCode,
        corridor_code: subGroup.corridor_code,
        center_lat: centerLat,
        center_lng: centerLng,
        employee_count: totalEmpCount,
        status: GroupStatus.PENDING,
        assigned_vehicle_id: undefined as any,
        assigned_driver_id: undefined as any,
        overflow_allowed: false,
        overflow_count: 0,
        recommendation_reason: `Restored from undo-split of ${siblings.length} sub-groups`,
        estimated_distance_km: maxDistance,
        estimated_duration_seconds: maxDuration,
        routing_source: subGroup.routing_source,
        corridor_label: subGroup.corridor_label,
        cluster_note: `Merged back: ${totalEmpCount} employees from ${siblings.length} sub-groups`,
      });
      const saved = await mgr.save(GeneratedRouteGroup, parent);

      // Batch-update all members to the new parent
      for (let seq = 0; seq < allMembers.length; seq++) {
        await mgr.update(GeneratedRouteGroupMember, allMembers[seq].id, {
          generated_group_id: saved.id,
          pickup_sequence: seq + 1,
        });
      }

      // Delete all sibling sub-groups
      await mgr.delete(GeneratedRouteGroup, siblingIds);

      // Update run total_groups
      if (subGroup.run_id) {
        const newGroupCount = await mgr.count(GeneratedRouteGroup, { where: { run_id: subGroup.run_id } });
        await mgr.update(RouteGroupRun, subGroup.run_id, { total_groups: newGroupCount });
      }

      // Revert DailyRun status
      if (subGroup.daily_run_id) {
        const dailyRun = await mgr.findOne(DailyRun, { where: { id: subGroup.daily_run_id } });
        if (dailyRun && [DailyRunStatus.READY, DailyRunStatus.ASSIGNING].includes(dailyRun.status)) {
          await mgr.update(DailyRun, dailyRun.id, {
            status: DailyRunStatus.ASSIGNING,
            total_groups: await mgr.count(GeneratedRouteGroup, { where: { daily_run_id: dailyRun.id, run_id: subGroup.run_id } }),
          });
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Undo split: merged ${siblings.length} sub-groups back into ${baseCode} (#${saved.id})`);

      return {
        mergedGroupId: saved.id,
        mergedGroupCode: baseCode,
        removedSubGroups: siblings.map(s => s.group_code),
        employeeCount: totalEmpCount,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Undo split rolled back for sub-group #${subGroupId}: ${(err as any)?.message || err}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Vehicle recommendation ──

  /**
   * Recommend a vehicle using effective capacity (capacity + type-aware overflow).
   * Only returns split-required if NO single vehicle can hold the group.
   */
  private recommendVehicle(
    employeeCount: number,
    vehicles: Vehicle[],
  ): { vehicleId: number | undefined; overflowNeeded: boolean; overflowCount: number; reason: string } {
    // Prefer driver-backed vehicles first, then any active vehicle
    const allActive = vehicles.filter(v => v.is_active !== false);
    const driverBacked = allActive.filter(v => !!v.driver_name);
    const pools = [driverBacked, allActive]; // try driver-backed first

    for (const pool of pools) {
      const candidates = pool
        .map(v => {
          const effCap = this.getEffectiveCapacity(v);
          const overflow = Math.max(0, employeeCount - v.capacity);
          return { vehicle: v, effCap, overflow, fits: employeeCount <= effCap, fitsBase: employeeCount <= v.capacity };
        })
        .filter(c => c.fits)
        .sort((a, b) => {
          if (a.fitsBase !== b.fitsBase) return a.fitsBase ? -1 : 1;
          return a.overflow - b.overflow;
        });

      if (candidates.length > 0) {
        const best = candidates[0];
        const v = best.vehicle;
        const hasDriver = !!v.driver_name;
        const driverNote = hasDriver ? '' : ' (no permanent driver — assign one first)';
        if (best.fitsBase) {
          return { vehicleId: v.id, overflowNeeded: false, overflowCount: 0, reason: `${v.type} ${v.registration_no} fits ${employeeCount} employees (capacity ${v.capacity})${driverNote}` };
        }
        return {
          vehicleId: v.id,
          overflowNeeded: true,
          overflowCount: best.overflow,
          reason: `${v.type} ${v.registration_no} fits ${employeeCount} with ${best.overflow} overflow (capacity ${v.capacity} + ${this.getOverflowAllowance(v)} overflow)${driverNote}`,
        };
      }
    }

    return { vehicleId: undefined, overflowNeeded: false, overflowCount: 0, reason: `No single vehicle for ${employeeCount} employees — use split-assign to allocate multiple vehicles` };
  }

  // ══════════════════════════════════════
  // ADVANCED Multi-Vehicle Split & Assign
  // ══════════════════════════════════════

  /**
   * Advanced scoring-based contiguous route split.
   * 
   * Algorithm:
   * 1. Members are already in stop sequence (route order from grouping engine)
   * 2. Build cumulative employee counts along the route
   * 3. Sort vehicles by effective capacity descending (largest gets the segment with most stops)
   * 4. Find optimal cut points using a scoring model that considers:
   *    - capacity fit (prefer normal capacity, overflow only when needed)
   *    - avoid tiny leftover segments
   *    - keep contiguous route sections
   * 5. Local rebalance: move 1-2 boundary stops to improve fit
   */
  private computeOptimalSplitPoints(
    memberCount: number,
    vehicles: Vehicle[],
  ): { targets: number[]; orderedVehicles: Vehicle[] } {
    // Sort vehicles by effective capacity descending — largest vehicle handles the biggest segment
    const sorted = [...vehicles].sort((a, b) =>
      this.getEffectiveCapacity(b) - this.getEffectiveCapacity(a),
    );

    const effCaps = sorted.map(v => this.getEffectiveCapacity(v));
    const baseCaps = sorted.map(v => v.capacity);
    const totalEffCap = effCaps.reduce((a, b) => a + b, 0);
    const n = sorted.length;

    // ── Phase 1: Initial proportional allocation based on capacity ratio ──
    const targets: number[] = new Array(n);
    let allocated = 0;
    for (let i = 0; i < n; i++) {
      if (i === n - 1) {
        targets[i] = memberCount - allocated;
      } else {
        // Proportional share based on each vehicle's effective capacity fraction
        const ideal = Math.round((effCaps[i] / totalEffCap) * memberCount);
        // Clamp: at least 1, at most effective capacity
        const clamped = Math.max(1, Math.min(ideal, effCaps[i], memberCount - allocated - (n - i - 1)));
        targets[i] = clamped;
        allocated += clamped;
      }
    }

    // ── Phase 2: Validate — ensure each segment fits its vehicle ──
    // If any segment exceeds its vehicle's effective capacity, redistribute
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        if (targets[i] > effCaps[i]) {
          let excess = targets[i] - effCaps[i];
          targets[i] = effCaps[i];
          // Push excess to the next vehicle that has room — decrement remaining
          for (let j = 0; j < n && excess > 0; j++) {
            if (j === i) continue;
            const room = effCaps[j] - targets[j];
            if (room > 0) {
              const take = Math.min(excess, room);
              targets[j] += take;
              excess -= take;
              changed = true;
            }
          }
        }
      }
      if (!changed) break;
    }

    // ── Phase 3: Scoring-based local rebalance ──
    // Try moving 1-2 stops between adjacent segments to improve scores
    for (let iter = 0; iter < 2; iter++) {
      let improved = false;
      for (let i = 0; i < n - 1; i++) {
        const currentScore = this.splitPointScore(targets[i], baseCaps[i], effCaps[i])
          + this.splitPointScore(targets[i + 1], baseCaps[i + 1], effCaps[i + 1]);

        // Try moving 1 stop from i to i+1
        if (targets[i] > 1 && targets[i + 1] + 1 <= effCaps[i + 1]) {
          const newScore = this.splitPointScore(targets[i] - 1, baseCaps[i], effCaps[i])
            + this.splitPointScore(targets[i + 1] + 1, baseCaps[i + 1], effCaps[i + 1]);
          if (newScore > currentScore) {
            targets[i]--;
            targets[i + 1]++;
            improved = true;
            continue;
          }
        }

        // Try moving 1 stop from i+1 to i
        if (targets[i + 1] > 1 && targets[i] + 1 <= effCaps[i]) {
          const newScore = this.splitPointScore(targets[i] + 1, baseCaps[i], effCaps[i])
            + this.splitPointScore(targets[i + 1] - 1, baseCaps[i + 1], effCaps[i + 1]);
          if (newScore > currentScore) {
            targets[i]++;
            targets[i + 1]--;
            improved = true;
            continue;
          }
        }
      }
      if (!improved) break;
    }

    // Final safety check: ensure total matches
    const totalAllocated = targets.reduce((a, b) => a + b, 0);
    if (totalAllocated !== memberCount) {
      // Adjust last vehicle
      targets[n - 1] += memberCount - totalAllocated;
    }

    return { targets, orderedVehicles: sorted };
  }

  /**
   * Score a split point: higher is better.
   * Rewards: fits within normal capacity, close to target.
   * Penalizes: overflow usage, tiny segments, exceeding effective capacity.
   */
  private splitPointScore(segmentSize: number, baseCap: number, effCap: number): number {
    if (segmentSize > effCap) return -1000; // Hard reject
    if (segmentSize <= 0) return -500; // Empty segment

    let score = 100;

    // Fits within normal capacity = best
    if (segmentSize <= baseCap) {
      score += 50;
      // Closer to normal capacity = better (less wasted seats)
      const utilization = segmentSize / baseCap;
      score += utilization * 30;
    } else {
      // Uses overflow — mild penalty proportional to overflow used
      const overflowUsed = segmentSize - baseCap;
      const overflowMax = effCap - baseCap;
      const overflowRatio = overflowMax > 0 ? overflowUsed / overflowMax : 1;
      score -= overflowRatio * 25;
    }

    // Penalize very tiny segments (less than 3 stops)
    if (segmentSize < 3) {
      score -= (3 - segmentSize) * 15;
    }

    return score;
  }

  async splitAndAssignVehicles(groupId: number, vehicleIds: number[]): Promise<any> {
    // ── Pre-validation (outside transaction — read-only) ──
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    if (group.status === GroupStatus.CONFIRMED) {
      throw new BadRequestException('Group is already confirmed. Unassign first to re-split.');
    }
    if (group.status === GroupStatus.DISPATCHED) {
      throw new BadRequestException('Group is already dispatched — cannot split.');
    }

    const members = await this.memberRepo.find({
      where: { generated_group_id: groupId },
      order: { pickup_sequence: 'ASC' },
    });

    if (members.length < 2) {
      throw new BadRequestException('Group has fewer than 2 members — cannot split.');
    }

    // Batch-load all vehicles
    const vehicles = await this.vehicleRepo.find({ where: { id: In(vehicleIds), is_active: true } });
    const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

    // Validate all vehicles exist and have drivers
    const validatedVehicles: Vehicle[] = [];
    for (const vid of vehicleIds) {
      const v = vehicleMap.get(vid);
      if (!v) throw new NotFoundException(`Vehicle #${vid} not found or not active`);
      if (!v.driver_name) {
        throw new BadRequestException(
          `Vehicle ${v.registration_no} has no permanent driver. Assign a driver in Vehicle Management first.`,
        );
      }
      validatedVehicles.push(v);
    }

    // ── Rule 1: Duplicate vehicle check — no vehicle already used in this daily run ──
    if (group.daily_run_id) {
      const existingAssigned = await this.groupRepo.find({
        where: { daily_run_id: group.daily_run_id, run_id: group.run_id },
      });
      const usedVehicleIds = new Set(
        existingAssigned.filter(g => g.id !== groupId && g.assigned_vehicle_id).map(g => g.assigned_vehicle_id!),
      );
      for (const vid of vehicleIds) {
        if (usedVehicleIds.has(vid)) {
          const v = vehicleMap.get(vid)!;
          throw new BadRequestException(
            `This vehicle is already assigned to another group for this day. (${v.registration_no})`,
          );
        }
      }
    }

    // Check for duplicate vehicle IDs in the request itself
    if (new Set(vehicleIds).size !== vehicleIds.length) {
      throw new BadRequestException('Duplicate vehicle IDs in split request. Each vehicle can only be used once.');
    }

    const totalCapacity = validatedVehicles.reduce((s, v) => s + this.getEffectiveCapacity(v), 0);
    if (members.length > totalCapacity) {
      throw new BadRequestException(
        `Total capacity of selected vehicles (${totalCapacity}) is less than group members (${members.length}). Add more vehicles.`,
      );
    }

    // ── ADVANCED: Compute optimal split points using scoring model ──
    const { targets, orderedVehicles } = this.computeOptimalSplitPoints(members.length, validatedVehicles);

    const allocations: { vehicle: Vehicle; memberSlice: GeneratedRouteGroupMember[] }[] = [];
    let offset = 0;
    for (let i = 0; i < orderedVehicles.length; i++) {
      const take = targets[i];
      if (take <= 0) continue;
      allocations.push({ vehicle: orderedVehicles[i], memberSlice: members.slice(offset, offset + take) });
      offset += take;
    }

    // ── Integrity validation: no duplication, no loss ──
    const totalAllocated = allocations.reduce((s, a) => s + a.memberSlice.length, 0);
    if (totalAllocated !== members.length) {
      throw new BadRequestException(
        `Split integrity error: allocated ${totalAllocated} members but group has ${members.length}. Aborting.`,
      );
    }
    const allocatedIds = new Set<number>();
    for (const a of allocations) {
      for (const m of a.memberSlice) {
        if (allocatedIds.has(m.employee_id)) {
          throw new BadRequestException(
            `Split integrity error: employee #${m.employee_id} appears in multiple segments. Aborting.`,
          );
        }
        allocatedIds.add(m.employee_id);
      }
    }

    const depot = this.routing.getDepot();
    const isAmazon = this.routing.isRouteIntelligenceAvailable();

    // Pre-compute routes in parallel
    const routeResults = await Promise.all(allocations.map(async ({ memberSlice }) => {
      let distanceKm = 0;
      let durationSeconds = 0;
      let routeGeometry: number[][] | null = null;
      let routingSource = group.routing_source || 'HAVERSINE_FALLBACK';

      if (isAmazon && memberSlice.length >= 1) {
        try {
          const waypoints: LatLng[] = [
            depot,
            ...memberSlice.map(m => ({ lat: Number(m.lat_snapshot), lng: Number(m.lng_snapshot) })),
          ];
          const route = await this.routing.calculateRoute(waypoints);
          if (route) {
            distanceKm = route.distance_km;
            durationSeconds = route.duration_seconds;
            routeGeometry = route.geometry;
            routingSource = 'AMAZON_ROUTE';
          }
        } catch (err: any) {
          this.logger.warn(`Split route calc failed: ${err?.message}`);
        }
      }

      if (distanceKm === 0) {
        for (const m of memberSlice) {
          const d = Number(m.depot_distance_km || 0);
          if (d > distanceKm) distanceKm = d;
        }
        distanceKm = distanceKm * 1.4;
        durationSeconds = distanceKm * 120;
        routingSource = 'HAVERSINE_FALLBACK';
      }

      return { distanceKm, durationSeconds, geometry: routeGeometry, source: routingSource };
    }));

    // ── ATOMIC TRANSACTION — all DB mutations happen here ──
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const mgr = queryRunner.manager;

      const lockedGroup = await mgr.findOne(GeneratedRouteGroup, {
        where: { id: groupId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedGroup) throw new NotFoundException('Group was deleted concurrently.');
      if (lockedGroup.status === GroupStatus.CONFIRMED) {
        throw new BadRequestException('Group was confirmed concurrently. Unassign first.');
      }

      const newGroups: any[] = [];
      for (let i = 0; i < allocations.length; i++) {
        const { vehicle, memberSlice } = allocations[i];
        const { distanceKm, durationSeconds, geometry, source } = routeResults[i];
        const subCode = `${group.group_code}-V${i + 1}`;
        const centerLat = memberSlice.reduce((s, m) => s + Number(m.lat_snapshot), 0) / memberSlice.length;
        const centerLng = memberSlice.reduce((s, m) => s + Number(m.lng_snapshot), 0) / memberSlice.length;
        const overflowCount = Math.max(0, memberSlice.length - vehicle.capacity);

        const subGroup = mgr.create(GeneratedRouteGroup, {
          run_id: group.run_id,
          daily_run_id: group.daily_run_id,
          group_code: subCode,
          corridor_code: group.corridor_code,
          center_lat: centerLat,
          center_lng: centerLng,
          employee_count: memberSlice.length,
          status: GroupStatus.CONFIRMED,
          assigned_vehicle_id: vehicle.id,
          recommended_vehicle_id: vehicle.id,
          overflow_allowed: overflowCount > 0,
          overflow_count: overflowCount,
          recommendation_reason: `Split from ${group.group_code}: vehicle ${vehicle.registration_no} (${vehicle.capacity} seats, stops ${memberSlice[0]?.pickup_sequence}–${memberSlice[memberSlice.length - 1]?.pickup_sequence})`,
          estimated_distance_km: Math.round(distanceKm * 100) / 100,
          estimated_duration_seconds: Math.round(durationSeconds),
          route_geometry: geometry ?? undefined,
          routing_source: source,
          corridor_label: group.corridor_label,
          cluster_note: `Split ${i + 1}/${allocations.length} from ${group.group_code}: ${memberSlice.length} employees → ${vehicle.registration_no} (contiguous stops ${memberSlice[0]?.pickup_sequence}–${memberSlice[memberSlice.length - 1]?.pickup_sequence})`,
        });
        const saved = await mgr.save(GeneratedRouteGroup, subGroup);

        // Move members
        for (let seq = 0; seq < memberSlice.length; seq++) {
          await mgr.update(GeneratedRouteGroupMember, memberSlice[seq].id, {
            generated_group_id: saved.id,
            pickup_sequence: seq + 1,
          });
        }

        // Audit trail
        await mgr.save(GroupVehicleAssignment, mgr.create(GroupVehicleAssignment, {
          group_id: saved.id,
          vehicle_id: vehicle.id,
          driver_id: undefined,
          notes: `Split from group ${group.group_code}, vehicle ${vehicle.registration_no}`,
        }));

        newGroups.push({
          ...saved,
          assigned_vehicle_reg: vehicle.registration_no,
          driver_name: vehicle.driver_name,
          driver_phone: vehicle.driver_phone,
          has_permanent_driver: true,
          members: memberSlice.map((m, idx) => ({
            ...m,
            pickup_sequence: idx + 1,
            generated_group_id: saved.id,
          })),
        });
      }

      // Delete original group
      await mgr.delete(GeneratedRouteGroup, groupId);

      // Update run total_groups
      if (group.run_id) {
        const newGroupCount = await mgr.count(GeneratedRouteGroup, { where: { run_id: group.run_id } });
        await mgr.update(RouteGroupRun, group.run_id, { total_groups: newGroupCount });
      }

      // DailyRun status update inside same transaction
      if (group.daily_run_id) {
        const dailyRun = await mgr.findOne(DailyRun, { where: { id: group.daily_run_id } });
        if (dailyRun) {
          const allGroups = await mgr.find(GeneratedRouteGroup, {
            where: { daily_run_id: dailyRun.id, run_id: group.run_id },
          });
          const allConfirmed = allGroups.every(g => g.status === GroupStatus.CONFIRMED);
          await mgr.update(DailyRun, dailyRun.id, {
            status: allConfirmed ? DailyRunStatus.READY : DailyRunStatus.ASSIGNING,
            total_groups: allGroups.length,
          });
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Advanced split: group ${group.group_code} (#${groupId}) → ${allocations.length} sub-groups: ${newGroups.map(g => g.group_code).join(', ')}`);

      return {
        originalGroupId: groupId,
        originalGroupCode: group.group_code,
        splitCount: newGroups.length,
        subGroups: newGroups,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Split transaction rolled back for group #${groupId}: ${err?.message || err}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Check if all groups for a daily run are confirmed and update DailyRun status accordingly.
   */
  private async checkAndUpdateDailyRunStatus(group: GeneratedRouteGroup): Promise<void> {
    if (!group.daily_run_id) return;

    const dailyRun = await this.dailyRunRepo.findOne({ where: { id: group.daily_run_id } });
    if (!dailyRun) return;

    if (dailyRun.status === DailyRunStatus.GROUPED) {
      await this.dailyRunRepo.update(dailyRun.id, { status: DailyRunStatus.ASSIGNING });
    }

    const allGroups = await this.groupRepo.find({
      where: { daily_run_id: dailyRun.id, run_id: group.run_id },
    });
    const allConfirmed = allGroups.length > 0 && allGroups.every(g => g.status === GroupStatus.CONFIRMED);
    if (allConfirmed) {
      await this.dailyRunRepo.update(dailyRun.id, {
        status: DailyRunStatus.READY,
        total_groups: allGroups.length,
      });
    }
  }

  /**
   * Split a group using ADVANCED scoring-based route-aware logic.
   * Uses the stop sequence and finds optimal cut points.
   */
  async splitGroup(groupId: number): Promise<any> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    if (group.status === GroupStatus.CONFIRMED) {
      throw new BadRequestException('Group is already confirmed. Unassign first before splitting.');
    }
    if (group.status === GroupStatus.DISPATCHED) {
      throw new BadRequestException('Group is already dispatched — cannot split.');
    }

    // Prevent splitting a group that's already a split sub-group
    if (/-V\d+$/.test(group.group_code)) {
      throw new BadRequestException('This group is already a split sub-group. Undo split first to re-split.');
    }

    const members = await this.memberRepo.find({
      where: { generated_group_id: groupId },
      order: { pickup_sequence: 'ASC' },
    });

    if (members.length < 2) {
      throw new BadRequestException('Group has fewer than 2 members — cannot split.');
    }

    // ── Advanced route-aware split ──
    // Find the optimal cut point using distance gaps between consecutive stops.
    // The best split point is where there's a natural "break" in the route.
    let bestSplitIdx = Math.ceil(members.length / 2); // default midpoint
    let bestGap = -1;

    // Search for the largest distance gap between consecutive stops
    // (restricted to the middle 60% to avoid tiny segments)
    const minIdx = Math.max(1, Math.floor(members.length * 0.2));
    const maxIdx = Math.min(members.length - 1, Math.ceil(members.length * 0.8));

    for (let i = minIdx; i < maxIdx; i++) {
      const lat1 = Number(members[i - 1].lat_snapshot);
      const lng1 = Number(members[i - 1].lng_snapshot);
      const lat2 = Number(members[i].lat_snapshot);
      const lng2 = Number(members[i].lng_snapshot);

      // Use depot distance difference as a proxy for route discontinuity
      const depotDist1 = Number(members[i - 1].depot_distance_km || 0);
      const depotDist2 = Number(members[i].depot_distance_km || 0);
      const gap = Math.abs(depotDist2 - depotDist1);

      // Also consider haversine distance between consecutive stops
      const dlat = lat2 - lat1;
      const dlng = lng2 - lng1;
      const directGap = Math.sqrt(dlat * dlat + dlng * dlng) * 111; // rough km

      const combinedGap = gap + directGap * 0.5;

      if (combinedGap > bestGap) {
        bestGap = combinedGap;
        bestSplitIdx = i;
      }
    }

    const slices = [members.slice(0, bestSplitIdx), members.slice(bestSplitIdx)];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const mgr = queryRunner.manager;

      const lockedGroup = await mgr.findOne(GeneratedRouteGroup, {
        where: { id: groupId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedGroup) throw new NotFoundException('Group was deleted concurrently.');
      if (lockedGroup.status === GroupStatus.CONFIRMED) {
        throw new BadRequestException('Group was confirmed concurrently.');
      }

      const newGroups: any[] = [];
      for (let i = 0; i < slices.length; i++) {
        const memberSlice = slices[i];
        if (memberSlice.length === 0) continue;

        const subCode = `${group.group_code}-V${i + 1}`;
        const centerLat = memberSlice.reduce((s, m) => s + Number(m.lat_snapshot), 0) / memberSlice.length;
        const centerLng = memberSlice.reduce((s, m) => s + Number(m.lng_snapshot), 0) / memberSlice.length;

        const subGroup = mgr.create(GeneratedRouteGroup, {
          run_id: group.run_id,
          daily_run_id: group.daily_run_id,
          group_code: subCode,
          corridor_code: group.corridor_code,
          center_lat: centerLat,
          center_lng: centerLng,
          employee_count: memberSlice.length,
          status: GroupStatus.PENDING,
          overflow_allowed: false,
          overflow_count: 0,
          recommendation_reason: `Smart split from ${group.group_code}: ${memberSlice.length} employees (contiguous route segment ${i + 1}, stops ${memberSlice[0]?.pickup_sequence}–${memberSlice[memberSlice.length - 1]?.pickup_sequence})`,
          estimated_distance_km: group.estimated_distance_km,
          estimated_duration_seconds: group.estimated_duration_seconds,
          routing_source: group.routing_source,
          corridor_label: group.corridor_label,
          cluster_note: `Split ${i + 1}/2 from ${group.group_code}: ${memberSlice.length} employees (contiguous route segment)`,
        });
        const saved = await mgr.save(GeneratedRouteGroup, subGroup);

        // Move members to sub-group
        for (let seq = 0; seq < memberSlice.length; seq++) {
          await mgr.update(GeneratedRouteGroupMember, memberSlice[seq].id, {
            generated_group_id: saved.id,
            pickup_sequence: seq + 1,
          });
        }

        newGroups.push({
          ...saved,
          members: memberSlice.map((m, idx) => ({
            ...m,
            pickup_sequence: idx + 1,
            generated_group_id: saved.id,
          })),
        });
      }

      // Delete original group
      await mgr.delete(GeneratedRouteGroup, groupId);

      // Update run total_groups
      if (group.run_id) {
        const newGroupCount = await mgr.count(GeneratedRouteGroup, { where: { run_id: group.run_id } });
        await mgr.update(RouteGroupRun, group.run_id, { total_groups: newGroupCount });
      }

      // Update DailyRun
      if (group.daily_run_id) {
        const dailyRun = await mgr.findOne(DailyRun, { where: { id: group.daily_run_id } });
        if (dailyRun) {
          const groupCount = await mgr.count(GeneratedRouteGroup, {
            where: { daily_run_id: dailyRun.id, run_id: group.run_id },
          });
          await mgr.update(DailyRun, dailyRun.id, {
            status: DailyRunStatus.ASSIGNING,
            total_groups: groupCount,
          });
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Advanced split group ${group.group_code} (#${groupId}) at stop ${bestSplitIdx} (gap=${bestGap?.toFixed(2)}km) into ${newGroups.length} sub-groups`);

      return {
        originalGroupId: groupId,
        originalGroupCode: group.group_code,
        splitCount: newGroups.length,
        subGroups: newGroups,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Split transaction rolled back for group #${groupId}: ${(err as any)?.message || err}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get list of vehicle IDs already assigned to groups in a daily run.
   * Used by frontend to filter out unavailable vehicles.
   */
  async getAssignedVehicleIds(dailyRunId: number, runId: number): Promise<number[]> {
    const groups = await this.groupRepo.find({
      where: { daily_run_id: dailyRunId, run_id: runId },
    });
    return groups
      .filter(g => g.assigned_vehicle_id != null)
      .map(g => g.assigned_vehicle_id!);
  }
}
