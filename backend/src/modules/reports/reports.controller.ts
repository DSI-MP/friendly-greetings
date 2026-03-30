import { Controller, Get, Query, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import {
  GeneratedRouteGroup, GeneratedRouteGroupMember, RouteGroupRun,
} from '../grouping/grouping.entity';
import { TransportRequest, TransportRequestEmployee } from '../transport-requests/transport-request.entity';
import { DailyRun } from '../daily-lock/daily-run.entity';
import { Employee } from '../employees/employee.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Department } from '../departments/department.entity';
import { Place } from '../places/place.entity';
import { SystemSetting } from '../settings/settings.entity';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';

/**
 * Reports Controller — V3 (daily-run-based)
 *
 * All reports look up data via daily_run_id (resolved from date param).
 * Returns fully shaped rows matching the frontend report type interfaces.
 *
 * N+1 optimized: vehicles and employees are batch-loaded per report.
 */
@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    @InjectRepository(GeneratedRouteGroup) private groupRepo: Repository<GeneratedRouteGroup>,
    @InjectRepository(GeneratedRouteGroupMember) private memberRepo: Repository<GeneratedRouteGroupMember>,
    @InjectRepository(RouteGroupRun) private runRepo: Repository<RouteGroupRun>,
    @InjectRepository(TransportRequest) private reqRepo: Repository<TransportRequest>,
    @InjectRepository(TransportRequestEmployee) private reqEmpRepo: Repository<TransportRequestEmployee>,
    @InjectRepository(DailyRun) private dailyRunRepo: Repository<DailyRun>,
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
    @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Department) private deptRepo: Repository<Department>,
    @InjectRepository(Place) private placeRepo: Repository<Place>,
    @InjectRepository(SystemSetting) private settingsRepo: Repository<SystemSetting>,
  ) {}

  // ── Helper: resolve latest run + groups from date ──

  private async resolveRunFromDate(date?: string): Promise<{
    run: RouteGroupRun | null;
    dailyRun: DailyRun | null;
    groups: GeneratedRouteGroup[];
  }> {
    if (!date) return { run: null, dailyRun: null, groups: [] };

    const dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: date as any } });
    if (!dailyRun) return { run: null, dailyRun: null, groups: [] };

    let run: RouteGroupRun | null = null;
    if (dailyRun.latest_run_id) {
      run = await this.runRepo.findOne({ where: { id: dailyRun.latest_run_id } });
    }
    if (!run) {
      run = await this.runRepo.findOne({
        where: { daily_run_id: dailyRun.id },
        order: { run_number: 'DESC' },
      });
    }
    if (!run) return { run: null, dailyRun, groups: [] };

    const groups = await this.groupRepo.find({
      where: { run_id: run.id },
      order: { group_code: 'ASC' },
    });

    return { run, dailyRun, groups };
  }

  /** Batch-load all members for multiple groups at once (eliminates N+1) */
  private async batchLoadMembers(groupIds: number[]): Promise<Map<number, GeneratedRouteGroupMember[]>> {
    if (groupIds.length === 0) return new Map();
    const allMembers = await this.memberRepo.find({
      where: { generated_group_id: In(groupIds) },
      order: { pickup_sequence: 'ASC' },
    });
    const map = new Map<number, GeneratedRouteGroupMember[]>();
    for (const m of allMembers) {
      if (!map.has(m.generated_group_id)) map.set(m.generated_group_id, []);
      map.get(m.generated_group_id)!.push(m);
    }
    return map;
  }

  /** Batch-load vehicles by IDs (eliminates N+1) */
  private async batchLoadVehicles(vehicleIds: number[]): Promise<Map<number, Vehicle>> {
    const unique = [...new Set(vehicleIds.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const vehicles = await this.vehicleRepo.findByIds(unique);
    return new Map(vehicles.map(v => [v.id, v]));
  }

  /** Batch-load employees by IDs */
  private async batchLoadEmployees(empIds: number[]): Promise<Map<number, Employee>> {
    const unique = [...new Set(empIds.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const emps = await this.empRepo.findByIds(unique);
    return new Map(emps.map(e => [e.id, e]));
  }

  private buildMeta(run: RouteGroupRun | null, dailyRun: DailyRun | null, date?: string) {
    const status = dailyRun?.status || 'UNKNOWN';
    let readiness: string;
    switch (status) {
      case 'HR_APPROVED': case 'DISPATCHED': readiness = 'ready'; break;
      case 'CLOSED': readiness = 'archived'; break;
      case 'SUBMITTED_TO_HR': readiness = 'awaiting-hr-approval'; break;
      case 'ASSIGNING': readiness = 'awaiting-assignment'; break;
      case 'GROUPED': readiness = 'preview'; break;
      case 'LOCKED': readiness = 'awaiting-grouping'; break;
      case 'READY': readiness = 'ready'; break;
      default: readiness = 'unavailable';
    }

    return {
      title: '',
      generatedAt: new Date().toISOString(),
      requestDate: date || '',
      workflowStatus: status,
      readiness,
      routingSource: run?.routing_source || 'UNKNOWN',
      totalGroups: run?.total_groups || 0,
      totalEmployees: run?.total_employees || 0,
      unresolvedCount: run?.unresolved_count || 0,
    };
  }

  // ══════════════════════════════════════
  // Unified report endpoint — GET /reports/:type
  // ══════════════════════════════════════

  @Get(':type')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY, AppRole.HR, AppRole.PLANNING, AppRole.HOD)
  async getReport(
    @Param('type') type: string,
    @Query('date') date?: string,
  ) {
    switch (type) {
      case 'route-wise': return this.routeWise(date);
      case 'vehicle-wise': return this.vehicleWise(date);
      case 'department-summary': return this.departmentSummary(date);
      case 'grouping': return this.groupingSummary(date);
      case 'dispatch-manifest': return this.dispatchManifest(date);
      case 'cost-summary': return this.costSummary(date);
      case 'exception': return this.exceptionReport(date);
      case 'archive': return this.archiveReport();
      case 'ot-plan': return this.otPlan(date);
      default: return { rows: [], meta: this.buildMeta(null, null, date) };
    }
  }

  // ── Batch-load places by IDs ──
  private async batchLoadPlaces(placeIds: number[]): Promise<Map<number, Place>> {
    const unique = [...new Set(placeIds.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const places = await this.placeRepo.findByIds(unique);
    return new Map(places.map(p => [p.id, p]));
  }

  // ── Route-Wise (batch-optimized) ──

  private async routeWise(date?: string) {
    const { run, dailyRun, groups } = await this.resolveRunFromDate(date);
    const meta = this.buildMeta(run, dailyRun, date);
    if (groups.length === 0) return { rows: [], meta };

    // Batch loads
    const groupIds = groups.map(g => g.id);
    const membersMap = await this.batchLoadMembers(groupIds);
    const allEmpIds = [...new Set(Array.from(membersMap.values()).flat().map(m => m.employee_id))];
    const empMap = await this.batchLoadEmployees(allEmpIds);
    const vehicleIds = groups.map(g => g.assigned_vehicle_id).filter(Boolean) as number[];
    const vehicleMap = await this.batchLoadVehicles(vehicleIds);

    // Batch-load places from member place_ids and employee place_ids
    const allPlaceIds: number[] = [];
    for (const members of membersMap.values()) {
      for (const m of members) {
        if (m.place_id) allPlaceIds.push(m.place_id);
      }
    }
    for (const emp of empMap.values()) {
      if (emp.place_id) allPlaceIds.push(emp.place_id);
    }
    const placeMap = await this.batchLoadPlaces(allPlaceIds);

    const rows: any[] = [];
    for (const g of groups) {
      const members = membersMap.get(g.id) || [];
      const v = g.assigned_vehicle_id ? vehicleMap.get(g.assigned_vehicle_id) : null;
      const vehicleReg = v?.registration_no || '';
      const driverName = v?.driver_name || '';
      const driverPhone = v?.driver_phone || '';

      // Resolve place names for all members in this group (for stops list + route name)
      const groupStops: string[] = [];
      const memberRows: any[] = [];
      // Bug fix #6: Deduplicate members by stable key (member id, fallback employee_id+sequence)
      const seenKeys = new Set<string>();

      for (const m of members) {
        const dedupKey = `${m.employee_id}-${m.pickup_sequence}`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);

        const emp = empMap.get(m.employee_id);
        // Bug fix #7: Resolve destination — prefer place name, fallback "Unnamed Drop Point"
        let destinationName = 'Unnamed Drop Point';
        if (m.place_id && placeMap.has(m.place_id)) {
          destinationName = placeMap.get(m.place_id)!.title;
        } else if (emp?.place_id && placeMap.has(emp.place_id)) {
          destinationName = placeMap.get(emp.place_id)!.title;
        }

        if (!groupStops.includes(destinationName) && destinationName !== 'Unnamed Drop Point') {
          groupStops.push(destinationName);
        }

        memberRows.push({
          requestDate: date || '',
          requestCode: g.group_code,
          groupCode: g.group_code,
          employeeNo: emp?.emp_no || '',
          employeeName: emp?.full_name || `Employee #${m.employee_id}`,
          destination: destinationName,
          vehicleReg,
          driverName,
          driverPhone,
          status: g.status,
          stopSequence: m.pickup_sequence,
        });
      }

      // Build human-readable route name: "DSI to <farthest destination>"
      const farthestStop = groupStops.length > 0
        ? groupStops[groupStops.length - 1]
        : (g.corridor_label || 'Unknown Area');
      const routeName = `DSI to ${farthestStop}`;

      // Attach routeName and stops to each row
      for (const row of memberRows) {
        row.routeName = routeName;
        row.stops = groupStops;
      }

      rows.push(...memberRows);
    }

    return { rows, meta };
  }

  // ── Vehicle-Wise (batch-optimized) ──

  private async vehicleWise(date?: string) {
    const { run, dailyRun, groups } = await this.resolveRunFromDate(date);
    const meta = this.buildMeta(run, dailyRun, date);
    if (groups.length === 0) return { rows: [], meta };

    const assignedGroups = groups.filter(g => g.assigned_vehicle_id);
    const groupIds = assignedGroups.map(g => g.id);
    const membersMap = await this.batchLoadMembers(groupIds);
    const allEmpIds = [...new Set(Array.from(membersMap.values()).flat().map(m => m.employee_id))];
    const empMap = await this.batchLoadEmployees(allEmpIds);
    const vehicleIds = assignedGroups.map(g => g.assigned_vehicle_id!);
    const vehicleMap = await this.batchLoadVehicles(vehicleIds);

    // Group by vehicle
    const byVehicle = new Map<number, { vehicle: Vehicle; groups: GeneratedRouteGroup[]; employees: Array<{ empNo: string; name: string }> }>();
    for (const g of assignedGroups) {
      const vid = g.assigned_vehicle_id!;
      if (!byVehicle.has(vid)) {
        const v = vehicleMap.get(vid);
        if (v) byVehicle.set(vid, { vehicle: v, groups: [], employees: [] });
      }
      const entry = byVehicle.get(vid);
      if (!entry) continue;
      entry.groups.push(g);
      const members = membersMap.get(g.id) || [];
      // Bug fix #6: Deduplicate members per vehicle
      const seenEmpIds = new Set(entry.employees.map(e => e.empNo));
      for (const m of members) {
        const emp = empMap.get(m.employee_id);
        const empNo = emp?.emp_no || '';
        if (empNo && seenEmpIds.has(empNo)) continue;
        if (empNo) seenEmpIds.add(empNo);
        entry.employees.push({ empNo, name: emp?.full_name || `Employee #${m.employee_id}` });
      }
    }

    const rows = Array.from(byVehicle.values()).map(({ vehicle, groups: vGroups, employees }) => ({
      vehicleReg: vehicle.registration_no || '',
      vehicleType: vehicle.type || 'VAN',
      driverName: vehicle.driver_name || '',
      driverPhone: vehicle.driver_phone || '',
      groupCodes: vGroups.map(g => g.group_code),
      employees,
      capacity: vehicle.capacity || 0,
      occupancy: employees.length,
      overflow: employees.length > (vehicle.capacity || 0),
      totalDistanceKm: vGroups.reduce((s, g) => s + Number(g.estimated_distance_km || 0), 0),
      totalDurationSeconds: vGroups.reduce((s, g) => s + (g.estimated_duration_seconds || 0), 0),
      routingSource: vGroups[0]?.routing_source || run?.routing_source || 'UNKNOWN',
    }));

    return { rows, meta };
  }

  // ── Department Summary ──

  private async departmentSummary(date?: string) {
    const { run, dailyRun, groups } = await this.resolveRunFromDate(date);
    const meta = this.buildMeta(run, dailyRun, date);

    const requests = date
      ? await this.reqRepo.find({ where: { request_date: date as any }, relations: ['department'] })
      : [];

    if (requests.length === 0) return { rows: [], meta };

    const requestIds = requests.map(r => r.id);
    const allReqEmps = requestIds.length > 0
      ? await this.reqEmpRepo.find({ where: { request_id: In(requestIds) } })
      : [];

    // Batch-load group members to build assigned set
    const assignedEmpIds = new Set<number>();
    if (run && groups.length > 0) {
      const membersMap = await this.batchLoadMembers(groups.map(g => g.id));
      for (const members of membersMap.values()) {
        for (const m of members) assignedEmpIds.add(m.employee_id);
      }
    }

    // Group by department
    const deptMap = new Map<number, {
      deptName: string;
      requestCodes: string[];
      totalEmps: Set<number>;
      assignedEmps: Set<number>;
      statuses: string[];
    }>();

    for (const req of requests) {
      const deptId = req.department_id;
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          deptName: req.department?.name || `Dept #${deptId}`,
          requestCodes: [],
          totalEmps: new Set(),
          assignedEmps: new Set(),
          statuses: [],
        });
      }
      const entry = deptMap.get(deptId)!;
      entry.requestCodes.push(`REQ-${req.id}`);
      entry.statuses.push(req.status);

      const reqEmps = allReqEmps.filter(re => re.request_id === req.id);
      for (const re of reqEmps) {
        entry.totalEmps.add(re.employee_id);
        if (assignedEmpIds.has(re.employee_id)) {
          entry.assignedEmps.add(re.employee_id);
        }
      }
    }

    const rows = Array.from(deptMap.values()).map(entry => {
      const total = entry.totalEmps.size;
      const assigned = entry.assignedEmps.size;
      // Use DailyRun status for department-level display (more accurate than individual request status)
      const displayStatus = dailyRun?.status || entry.statuses[entry.statuses.length - 1] || 'UNKNOWN';
      return {
        departmentName: entry.deptName,
        totalEmployees: total,
        assignedEmployees: assigned,
        unassignedEmployees: total - assigned,
        approvedStatus: displayStatus,
        requestStatus: displayStatus,
        requestCode: entry.requestCodes.join(', '),
        reportReady: dailyRun?.status
          ? ['READY', 'DISPATCHED', 'CLOSED'].includes(dailyRun.status)
          : false,
      };
    });

    return { rows, meta };
  }

  // ── Grouping Summary (batch-optimized) ──

  private async groupingSummary(date?: string) {
    const { run, dailyRun, groups } = await this.resolveRunFromDate(date);
    const meta = this.buildMeta(run, dailyRun, date);
    if (groups.length === 0) return { rows: [], meta };

    // Batch-load vehicles
    const vehicleIds = [
      ...groups.map(g => g.recommended_vehicle_id),
      ...groups.map(g => g.assigned_vehicle_id),
    ].filter(Boolean) as number[];
    const vehicleMap = await this.batchLoadVehicles(vehicleIds);

    const rows = groups.map(g => {
      const recVehicle = g.recommended_vehicle_id ? vehicleMap.get(g.recommended_vehicle_id) : null;
      const assignedVehicle = g.assigned_vehicle_id ? vehicleMap.get(g.assigned_vehicle_id) : null;
      return {
        groupCode: g.group_code,
        routeCorridor: g.corridor_label || `Corridor ${g.corridor_code || '?'}`,
        memberCount: g.employee_count,
        clusterNote: g.cluster_note || '',
        recommendedVehicle: recVehicle?.registration_no || '',
        assignedVehicle: assignedVehicle?.registration_no || '',
        driverName: assignedVehicle?.driver_name || '',
        overflowWarning: g.overflow_allowed,
        recommendationReason: g.recommendation_reason || '',
        estimatedDistanceKm: Number(g.estimated_distance_km || 0),
        estimatedDurationSeconds: g.estimated_duration_seconds || 0,
        routingSource: g.routing_source || run?.routing_source || 'UNKNOWN',
      };
    });

    return { rows, meta };
  }

  // ── Dispatch Manifest (batch-optimized) ──

  private async dispatchManifest(date?: string) {
    const { run, dailyRun, groups } = await this.resolveRunFromDate(date);
    const meta = this.buildMeta(run, dailyRun, date);

    const assignedGroups = groups.filter(g => g.assigned_vehicle_id);
    if (assignedGroups.length === 0) return { rows: [], meta };

    const groupIds = assignedGroups.map(g => g.id);
    const membersMap = await this.batchLoadMembers(groupIds);
    const allEmpIds = [...new Set(Array.from(membersMap.values()).flat().map(m => m.employee_id))];
    const empMap = await this.batchLoadEmployees(allEmpIds);
    const vehicleIds = assignedGroups.map(g => g.assigned_vehicle_id!);
    const vehicleMap = await this.batchLoadVehicles(vehicleIds);

    // Batch-load places for dispatch manifest destination resolution
    const allPlaceIds: number[] = [];
    for (const members of membersMap.values()) {
      for (const m of members) { if (m.place_id) allPlaceIds.push(m.place_id); }
    }
    for (const emp of empMap.values()) { if (emp.place_id) allPlaceIds.push(emp.place_id); }
    const placeMap = await this.batchLoadPlaces(allPlaceIds);

    const rows = assignedGroups.map(g => {
      const members = membersMap.get(g.id) || [];
      const v = vehicleMap.get(g.assigned_vehicle_id!);
      return {
        requestDate: date || '',
        groupCode: g.group_code,
        vehicleReg: v?.registration_no || '',
        driverName: v?.driver_name || '',
        driverPhone: v?.driver_phone || '',
        employees: (() => {
          // Bug fix #6: Deduplicate dispatch members
          const seenKeys = new Set<string>();
          return members.filter(m => {
            const key = `${m.employee_id}-${m.pickup_sequence}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          }).map(m => {
            const emp = empMap.get(m.employee_id);
            // Bug fix #7: Resolve place name, fallback "Unnamed Drop Point"
            let dest = 'Unnamed Drop Point';
            if (m.place_id && placeMap.has(m.place_id)) dest = placeMap.get(m.place_id)!.title;
            else if (emp?.place_id && placeMap.has(emp.place_id)) dest = placeMap.get(emp.place_id)!.title;
            return {
              empNo: emp?.emp_no || '',
              name: emp?.full_name || `Employee #${m.employee_id}`,
              destination: dest,
              sequence: m.pickup_sequence,
            };
          });
        })(),
        notes: g.cluster_note || '',
        estimatedDistanceKm: Number(g.estimated_distance_km || 0),
        estimatedDurationSeconds: g.estimated_duration_seconds || 0,
        routingSource: g.routing_source || 'UNKNOWN',
      };
    });

    return { rows, meta };
  }

  // ── Cost Summary ──

  private async costSummary(date?: string) {
    const { run, dailyRun, groups } = await this.resolveRunFromDate(date);
    const meta = this.buildMeta(run, dailyRun, date);

    // Load cost_per_km from system settings (default 50 LKR)
    let costPerKm = 50;
    try {
      const setting = await this.settingsRepo.findOne({ where: { key: 'cost_per_km' } });
      if (setting?.value) costPerKm = Number(setting.value) || 50;
    } catch {}

    const rows = groups.map(g => {
      const distKm = Number(g.estimated_distance_km || 0);
      const routeCost = distKm * costPerKm;
      return {
        routeGroup: g.group_code,
        estimatedDistanceKm: distKm,
        estimatedCost: routeCost,
        vehicleCost: routeCost,
        costPerEmployee: g.employee_count > 0 ? routeCost / g.employee_count : 0,
        departmentTotal: routeCost,
        employeeCount: g.employee_count,
        costPerKm,
        routingSource: g.routing_source || 'UNKNOWN',
      };
    });

    return { rows, meta };
  }

  // ── Exception Report ──

  private async exceptionReport(date?: string) {
    const { run, dailyRun, groups } = await this.resolveRunFromDate(date);
    const meta = this.buildMeta(run, dailyRun, date);

    const rows: any[] = [];

    for (const g of groups) {
      if (g.overflow_allowed) {
        rows.push({
          type: 'overflow',
          description: `Group ${g.group_code}: ${g.overflow_count} employees over capacity`,
          groupCode: g.group_code,
          severity: 'medium',
          requestCode: g.group_code,
        });
      }
      if (!g.assigned_vehicle_id) {
        rows.push({
          type: 'unassigned',
          description: `Group ${g.group_code}: No vehicle assigned`,
          groupCode: g.group_code,
          severity: 'high',
          requestCode: g.group_code,
        });
      }
    }

    if (run?.routing_warning) {
      rows.push({
        type: 'warning',
        description: run.routing_warning,
        severity: 'medium',
        requestCode: 'SYSTEM',
      });
    }

    return { rows, meta };
  }

  // ── Archive (batch-optimized) ──

  private async archiveReport() {
    const meta = this.buildMeta(null, null);
    const runs = await this.runRepo.find({ order: { created_at: 'DESC' }, take: 50 });

    if (runs.length === 0) return { rows: [], meta };

    // Batch-load daily runs for all runs that have daily_run_id
    const dailyRunIds = [...new Set(runs.map(r => r.daily_run_id).filter(Boolean))] as number[];
    const dailyRuns = dailyRunIds.length > 0
      ? await this.dailyRunRepo.find({ where: { id: In(dailyRunIds) } })
      : [];
    const dailyRunMap = new Map(dailyRuns.map(dr => [dr.id, dr]));

    // Batch-load all groups for all runs
    const runIds = runs.map(r => r.id);
    const allGroups = await this.groupRepo.find({ where: { run_id: In(runIds) } });

    // Group by run_id
    const groupsByRun = new Map<number, GeneratedRouteGroup[]>();
    for (const g of allGroups) {
      if (!groupsByRun.has(g.run_id)) groupsByRun.set(g.run_id, []);
      groupsByRun.get(g.run_id)!.push(g);
    }

    const rows = runs.map(r => {
      const runGroups = groupsByRun.get(r.id) || [];
      const totalVehicles = new Set(
        runGroups.filter(g => g.assigned_vehicle_id).map(g => g.assigned_vehicle_id),
      ).size;

      // Use daily run date if available, else extract from parameters, else fall back to created_at
      const dailyRun = r.daily_run_id ? dailyRunMap.get(r.daily_run_id) : null;
      const dailyRunDate = dailyRun?.run_date;
      const paramDate = (r.parameters as any)?.date;
      const requestDate = dailyRunDate
        ? (typeof dailyRunDate === 'string' ? dailyRunDate : (dailyRunDate as any)?.toISOString?.()?.split('T')[0])
        : paramDate || r.created_at?.toISOString?.()?.split('T')[0] || '';
      const dailyRunStatus = dailyRun?.status || 'ARCHIVED';

      return {
        requestCode: `RUN-${r.id}`,
        requestDate: requestDate || '',
        closedDate: dailyRunStatus === 'CLOSED' && dailyRun ? (dailyRun as any).updated_at?.toISOString?.()?.split('T')[0] || '' : '',
        departmentName: dailyRun ? `${(r.parameters as any)?.departmentCount || '?'} departments` : '',
        totalEmployees: r.total_employees || 0,
        totalGroups: r.total_groups || 0,
        totalVehicles,
        finalStatus: dailyRunStatus,
        routingSource: r.routing_source || 'UNKNOWN',
      };
    });

    return { rows, meta };
  }

  // ── Print endpoint (PDF data) ──

  @Get('print/:date/:type')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY, AppRole.HR)
  async printReport(@Param('date') date: string, @Param('type') type: string) {
    return this.getReport(type, date);
  }

  // ── OT Plan (final approved, grouped by department) ──

  private async otPlan(date?: string) {
    const { run, dailyRun, groups } = await this.resolveRunFromDate(date);
    const meta = this.buildMeta(run, dailyRun, date);

    // OT plan is only available after HR approval
    const readyStatuses = ['HR_APPROVED', 'DISPATCHED', 'CLOSED'];
    if (!dailyRun || !readyStatuses.includes(dailyRun.status)) {
      return {
        rows: [],
        meta: {
          ...meta,
          title: 'Final OT Plan',
          readiness: dailyRun ? meta.readiness : 'unavailable',
          totalDepartments: 0,
          totalEmployees: 0,
        },
      };
    }

    // Collect request employees from HR_APPROVED (or DISPATCHED/CLOSED) requests for this date
    const requests = await this.reqRepo.find({
      where: { request_date: date as any, status: In(readyStatuses.map(s => s as any)) },
      relations: ['department'],
    });

    if (requests.length === 0) {
      return {
        rows: [],
        meta: { ...meta, title: 'Final OT Plan', totalDepartments: 0, totalEmployees: 0 },
      };
    }

    const requestIds = requests.map(r => r.id);
    const allReqEmps = await this.reqEmpRepo.find({
      where: { request_id: In(requestIds) },
    });

    // Collect unique employee IDs
    const empIdSet = new Set<number>();
    for (const re of allReqEmps) empIdSet.add(re.employee_id);
    const empIds = [...empIdSet];

    if (empIds.length === 0) {
      return {
        rows: [],
        meta: { ...meta, title: 'Final OT Plan', totalDepartments: 0, totalEmployees: 0 },
      };
    }

    // Batch load employees
    const empMap = await this.batchLoadEmployees(empIds);

    // Build department map from requests
    const deptNameMap = new Map<number, string>();
    for (const req of requests) {
      if (req.department_id && req.department?.name) {
        deptNameMap.set(req.department_id, req.department.name);
      }
    }

    // If any employee department isn't covered, batch-load those departments
    const missingDeptIds: number[] = [];
    for (const emp of empMap.values()) {
      if (emp.department_id && !deptNameMap.has(emp.department_id)) {
        missingDeptIds.push(emp.department_id);
      }
    }
    if (missingDeptIds.length > 0) {
      const depts = await this.deptRepo.findByIds([...new Set(missingDeptIds)]);
      for (const d of depts) deptNameMap.set(d.id, d.name);
    }

    // Map each request employee to their department
    const deptGroups = new Map<number, { departmentName: string; employees: Map<number, { employeeId: number; empNo: string; fullName: string }> }>();

    for (const re of allReqEmps) {
      const emp = empMap.get(re.employee_id);
      if (!emp) continue;
      const deptId = emp.department_id;
      if (!deptGroups.has(deptId)) {
        deptGroups.set(deptId, {
          departmentName: deptNameMap.get(deptId) || `Department #${deptId}`,
          employees: new Map(),
        });
      }
      const group = deptGroups.get(deptId)!;
      if (!group.employees.has(emp.id)) {
        group.employees.set(emp.id, {
          employeeId: emp.id,
          empNo: emp.emp_no || '',
          fullName: emp.full_name,
        });
      }
    }

    const rows = Array.from(deptGroups.entries())
      .sort(([, a], [, b]) => a.departmentName.localeCompare(b.departmentName))
      .map(([deptId, group]) => ({
        departmentId: deptId,
        departmentName: group.departmentName,
        employees: Array.from(group.employees.values()).sort((a, b) => a.fullName.localeCompare(b.fullName)),
        totalEmployees: group.employees.size,
      }));

    const totalEmployees = rows.reduce((sum, r) => sum + r.totalEmployees, 0);

    return {
      rows,
      meta: {
        ...meta,
        title: 'Final OT Plan',
        readiness: 'ready',
        totalDepartments: rows.length,
        totalEmployees,
      },
    };
  }
}
