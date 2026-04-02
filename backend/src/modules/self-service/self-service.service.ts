import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LocationChangeRequest, LocationChangeStatus } from './location-change-request.entity';
import { Employee } from '../employees/employee.entity';
import { Place } from '../places/place.entity';
import { TransportRequest, TransportRequestEmployee } from '../transport-requests/transport-request.entity';
import { GeneratedRouteGroup, GeneratedRouteGroupMember, RouteGroupRun } from '../grouping/grouping.entity';
import { DailyRun } from '../daily-lock/daily-run.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Department } from '../departments/department.entity';
import { RequestStatus } from '../../common/enums';

@Injectable()
export class SelfServiceService {
  constructor(
    @InjectRepository(LocationChangeRequest) private lcrRepo: Repository<LocationChangeRequest>,
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
    @InjectRepository(Place) private placeRepo: Repository<Place>,
    @InjectRepository(TransportRequest) private reqRepo: Repository<TransportRequest>,
    @InjectRepository(TransportRequestEmployee) private reqEmpRepo: Repository<TransportRequestEmployee>,
    @InjectRepository(GeneratedRouteGroup) private groupRepo: Repository<GeneratedRouteGroup>,
    @InjectRepository(GeneratedRouteGroupMember) private memberRepo: Repository<GeneratedRouteGroupMember>,
    @InjectRepository(RouteGroupRun) private runRepo: Repository<RouteGroupRun>,
    @InjectRepository(DailyRun) private dailyRunRepo: Repository<DailyRun>,
    @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Department) private deptRepo: Repository<Department>,
  ) {}

  /* ── Location Change ── */

  async requestLocationChange(userId: number, data: { locationName: string; lat: number; lng: number; reason?: string }) {
    const name = data.locationName?.trim();
    if (!name) throw new BadRequestException('Location name is required');
    if (!data.lat || !data.lng) throw new BadRequestException('Coordinates are required');

    const existingPlace = await this.placeRepo.findOne({ where: { title: name } });
    if (existingPlace) {
      throw new BadRequestException('This location name already exists in the database. Please use a unique name (e.g. your Employee ID).');
    }

    const emp = await this.empRepo.findOne({ where: { user_id: userId } });

    const existing = await this.lcrRepo.findOne({
      where: { user_id: userId, place_title: name, status: LocationChangeStatus.PENDING },
    });
    if (existing) throw new BadRequestException('You already have a pending request with this location name');

    const req = this.lcrRepo.create({
      user_id: userId,
      employee_id: emp?.id,
      place_title: name,
      lat: data.lat,
      lng: data.lng,
      reason: data.reason?.trim() || undefined,
    });
    return this.lcrRepo.save(req);
  }

  async findAllRequests(status?: string) {
    const where: any = {};
    if (status) where.status = status;
    return this.lcrRepo.find({ where, order: { created_at: 'DESC' } });
  }

  async approveRequest(id: number, reviewerId: number, note?: string) {
    const req = await this.lcrRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== LocationChangeStatus.PENDING) throw new BadRequestException('Request is not pending');

    const newPlace = this.placeRepo.create({
      title: req.place_title || `Location-${req.id}`,
      latitude: req.lat,
      longitude: req.lng,
      is_active: true,
    });
    const savedPlace = await this.placeRepo.save(newPlace);

    if (req.employee_id) {
      await this.empRepo.update(req.employee_id, {
        place_id: savedPlace.id,
        lat: req.lat,
        lng: req.lng,
      });
    }

    await this.lcrRepo.update(id, {
      status: LocationChangeStatus.APPROVED,
      place_id: savedPlace.id,
      reviewed_by: reviewerId,
      review_note: note?.trim() || undefined,
      reviewed_at: new Date(),
    });

    return { message: 'Location change approved, new place created and employee location updated' };
  }

  async rejectRequest(id: number, reviewerId: number, note?: string) {
    const req = await this.lcrRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== LocationChangeStatus.PENDING) throw new BadRequestException('Request is not pending');

    await this.lcrRepo.update(id, {
      status: LocationChangeStatus.REJECTED,
      reviewed_by: reviewerId,
      review_note: note?.trim() || undefined,
      reviewed_at: new Date(),
    });

    return { message: 'Location change rejected' };
  }

  /* ── Employee Overview (for EMP dashboard) ── */

  async getOverview(userId: number) {
    const emp = await this.empRepo.findOne({ where: { user_id: userId } });
    if (!emp) {
      return {
        employee: { id: 0, full_name: 'Unknown', email: '', department_name: '' },
        today_transport: null,
        recent_trips: [],
        pending_issues: [],
        pending_location_requests: [],
      };
    }

    const dept = await this.deptRepo.findOne({ where: { id: emp.department_id } });

    // Get today's transport
    const today = new Date().toISOString().split('T')[0];
    const todayTransport = await this.resolveEmployeeTransport(emp.id, today);

    // Get recent trips (last 10 dates)
    const recentTrips = await this.resolveRecentTrips(emp.id, 10);

    // Pending location requests
    const pendingLocations = await this.lcrRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 10,
    });

    return {
      employee: {
        id: emp.id,
        full_name: emp.full_name,
        email: emp.email,
        phone: emp.phone,
        emp_no: emp.emp_no,
        department_name: dept?.name || '',
      },
      today_transport: todayTransport,
      recent_trips: recentTrips,
      pending_issues: [],
      pending_location_requests: pendingLocations.map(r => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        reason: r.reason,
        status: r.status,
        created_at: r.created_at,
      })),
    };
  }

  /* ── Transport History (for EMP transport page) ── */

  async getTransportHistory(userId: number) {
    const emp = await this.empRepo.findOne({ where: { user_id: userId } });
    if (!emp) return [];
    return this.resolveRecentTrips(emp.id, 50);
  }

  /* ── Private helpers ── */

  private async resolveEmployeeTransport(empId: number, date: string): Promise<any | null> {
    // Find requests that include this employee for the given date
    const reqEmps = await this.reqEmpRepo
      .createQueryBuilder('re')
      .innerJoin('transport_requests', 'tr', 'tr.id = re.request_id')
      .where('re.employee_id = :empId', { empId })
      .andWhere('tr.request_date = :date', { date })
      .andWhere('tr.status IN (:...statuses)', {
        statuses: [
          RequestStatus.HR_APPROVED, RequestStatus.DISPATCHED,
          RequestStatus.CLOSED, RequestStatus.TA_COMPLETED,
          RequestStatus.GROUPING_COMPLETED, RequestStatus.TA_PROCESSING,
          RequestStatus.DAILY_LOCKED,
        ],
      })
      .select(['re.request_id', 're.employee_id', 're.drop_notes', 're.pickup_notes'])
      .getRawMany();

    if (reqEmps.length === 0) return null;

    // Try to find grouping assignment
    const groupMember = await this.memberRepo.findOne({
      where: { employee_id: empId },
      order: { id: 'DESC' },
    });

    let group: GeneratedRouteGroup | null = null;
    let vehicle: Vehicle | null = null;

    if (groupMember) {
      group = await this.groupRepo.findOne({ where: { id: groupMember.generated_group_id } });
      if (group?.assigned_vehicle_id) {
        vehicle = await this.vehicleRepo.findOne({ where: { id: group.assigned_vehicle_id } });
      }
    }

    // Resolve human-readable route name: "DSI to <farthest destination>"
    const routeDisplayName = await this.resolveRouteDisplayName(group);

    return {
      request_date: date,
      route_name: routeDisplayName,
      group_code: group?.group_code || null,
      registration_no: vehicle?.registration_no || null,
      vehicle_type: vehicle?.type || null,
      driver_name: vehicle?.driver_name || null,
      driver_phone: vehicle?.driver_phone || null,
      drop_note: reqEmps[0]?.re_drop_notes || null,
      pickup_note: reqEmps[0]?.re_pickup_notes || null,
      status: group?.status || 'PENDING',
    };
  }

  private async resolveRecentTrips(empId: number, limit: number): Promise<any[]> {
    // Find all request-employee links for this employee
    const reqEmps = await this.reqEmpRepo
      .createQueryBuilder('re')
      .innerJoin('transport_requests', 'tr', 'tr.id = re.request_id')
      .where('re.employee_id = :empId', { empId })
      .andWhere('tr.status IN (:...statuses)', {
        statuses: [
          RequestStatus.HR_APPROVED, RequestStatus.DISPATCHED,
          RequestStatus.CLOSED, RequestStatus.TA_COMPLETED,
          RequestStatus.GROUPING_COMPLETED,
        ],
      })
      .select(['re.request_id as request_id', 're.drop_notes as drop_notes', 'tr.request_date as request_date', 'tr.status as status'])
      .orderBy('tr.request_date', 'DESC')
      .limit(limit)
      .getRawMany();

    if (reqEmps.length === 0) return [];

    // For each, try to resolve group info
    const trips: any[] = [];
    for (const re of reqEmps) {
      // Find group member for this employee in the context of this request's date
      const dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: re.request_date } });
      let group: GeneratedRouteGroup | null = null;
      let vehicle: Vehicle | null = null;

      if (dailyRun?.latest_run_id) {
        const member = await this.memberRepo.findOne({
          where: { employee_id: empId },
          order: { id: 'DESC' },
        });
        if (member) {
          group = await this.groupRepo.findOne({ where: { id: member.generated_group_id } });
          if (group?.assigned_vehicle_id) {
            vehicle = await this.vehicleRepo.findOne({ where: { id: group.assigned_vehicle_id } });
          }
        }
      }

      // Resolve human-readable route name
      const routeDisplayName = await this.resolveRouteDisplayName(group);

      trips.push({
        request_date: typeof re.request_date === 'string' ? re.request_date : new Date(re.request_date).toISOString().split('T')[0],
        route_name: routeDisplayName,
        group_code: group?.group_code || null,
        registration_no: vehicle?.registration_no || null,
        vehicle_type: vehicle?.type || null,
        driver_name: vehicle?.driver_name || null,
        driver_phone: vehicle?.driver_phone || null,
        drop_note: re.drop_notes || null,
        pickup_note: null,
        status: re.status || group?.status || 'PENDING',
      });
    }

    return trips;
  }

  /**
   * Resolve a human-readable route name for employee-facing views.
   * Format: "DSI to <farthest destination place name>"
   * Falls back gracefully if no place data is available.
   */
  private async resolveRouteDisplayName(group: GeneratedRouteGroup | null): Promise<string | null> {
    if (!group) return null;

    try {
      // Get group members ordered by pickup sequence (farthest = last)
      const members = await this.memberRepo.find({
        where: { generated_group_id: group.id },
        order: { pickup_sequence: 'DESC' },
      });

      if (members.length > 0) {
        // Find farthest member with a place_id
        for (const member of members) {
          if (member.place_id) {
            const place = await this.placeRepo.findOne({ where: { id: member.place_id } });
            if (place?.title) {
              return `DSI to ${place.title}`;
            }
          }
        }
      }

      // Fallback: try to extract a meaningful name from corridor_label
      const label = group.corridor_label || '';
      // If it looks like "Direction C10", don't show it
      if (/^Direction\s+C\d+/i.test(label) || !label || label === 'Route') {
        return group.group_code ? `DSI Route ${group.group_code}` : 'DSI Transport';
      }

      return `DSI to ${label}`;
    } catch {
      return group.corridor_label || null;
    }
  }
}
