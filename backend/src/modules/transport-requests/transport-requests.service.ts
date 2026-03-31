import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  TransportRequest,
  TransportRequestEmployee,
  RequestStatusHistory,
  ApprovalHistory,
} from './transport-request.entity';
import { PaginatedResult } from '../../common/dto';
import { RequestStatus, AppRole } from '../../common/enums';
import { Department } from '../departments/department.entity';
import { Employee } from '../employees/employee.entity';
import { User } from '../users/user.entity';
import { Place } from '../places/place.entity';
import { DailyRun, DailyRunStatus } from '../daily-lock/daily-run.entity';
import { NotificationsService } from '../notifications/notifications.service';

/* ─── Internal types ─── */

interface CreatePayload {
  departmentId: number;
  requestDate: string;
  notes?: string;
  otTime?: string;
}

interface ListQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  departmentId?: number;
  status?: RequestStatus;
}

/* ─── Service ─── */

@Injectable()
export class TransportRequestsService {
  private readonly logger = new Logger(TransportRequestsService.name);

  constructor(
    @InjectRepository(TransportRequest) private readonly reqRepo: Repository<TransportRequest>,
    @InjectRepository(TransportRequestEmployee) private readonly reqEmpRepo: Repository<TransportRequestEmployee>,
    @InjectRepository(RequestStatusHistory) private readonly historyRepo: Repository<RequestStatusHistory>,
    @InjectRepository(ApprovalHistory) private readonly approvalRepo: Repository<ApprovalHistory>,
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
    @InjectRepository(Employee) private readonly empRepo: Repository<Employee>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    @InjectRepository(DailyRun) private readonly dailyRunRepo: Repository<DailyRun>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /* ────────────────── List ────────────────── */

  async findAll(query: ListQuery): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'request_date',
      sortOrder = 'DESC',
      departmentId,
      status,
    } = query;

    const where: any = {};
    if (departmentId) where.department_id = departmentId;
    if (status) where.status = status;

    const [items, total] = await this.reqRepo.findAndCount({
      where,
      relations: ['department'],
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Batch-load employee counts for all requests in this page
    const requestIds = items.map(r => r.id);
    const empCounts = new Map<number, number>();
    if (requestIds.length > 0) {
      const counts = await this.reqEmpRepo
        .createQueryBuilder('re')
        .select('re.request_id', 'request_id')
        .addSelect('COUNT(*)::int', 'count')
        .where('re.request_id IN (:...ids)', { ids: requestIds })
        .groupBy('re.request_id')
        .getRawMany();
      for (const c of counts) {
        empCounts.set(Number(c.request_id), Number(c.count));
      }
    }

    const enriched = items.map(r => ({
      ...r,
      department_name: r.department?.name || null,
      employee_count: empCounts.get(r.id) || 0,
    }));

    return { items: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /* ────────────────── Single request with full details ────────────────── */

  async findById(id: number): Promise<any> {
    const req = await this.reqRepo.findOne({
      where: { id },
      relations: ['department', 'createdByUser'],
    });
    if (!req) throw new NotFoundException(`Transport request #${id} not found`);

    // Load employees
    const reqEmps = await this.reqEmpRepo.find({
      where: { request_id: id },
      order: { created_at: 'ASC' },
    });
    const employeeIds = reqEmps.map(re => re.employee_id);
    let employees: any[] = [];
    if (employeeIds.length > 0) {
      const emps = await this.empRepo.findByIds(employeeIds);

      // Resolve places for employees that have place_id
      const placeIds = [...new Set(emps.filter(e => e.place_id).map(e => e.place_id!))];
      const places = placeIds.length > 0 ? await this.placeRepo.findByIds(placeIds) : [];
      const placeMap = new Map(places.map(p => [p.id, p]));

      employees = emps.map(e => {
        const place = e.place_id ? placeMap.get(e.place_id) : null;
        const resolvedLat = e.lat ? Number(e.lat) : (place ? Number(place.latitude) : undefined);
        const resolvedLng = e.lng ? Number(e.lng) : (place ? Number(place.longitude) : undefined);
        const locationResolved = !!(resolvedLat && resolvedLng && resolvedLat !== 0 && resolvedLng !== 0);

        return {
          id: e.id,
          emp_no: e.emp_no || '',
          full_name: e.full_name,
          department: e.department_id?.toString(),
          phone: e.phone,
          destination_location: place?.title || undefined,
          lat: resolvedLat,
          lng: resolvedLng,
          location_resolved: locationResolved,
          place_id: e.place_id,
          place_title: place?.title,
        };
      });
    }

    // Load status history
    const statusHistory = await this.historyRepo.find({
      where: { request_id: id },
      order: { created_at: 'ASC' },
    });

    // Resolve user names
    const userIds = new Set<number>();
    if (req.created_by_user_id) userIds.add(req.created_by_user_id);
    statusHistory.forEach(h => { if (h.changed_by_user_id) userIds.add(h.changed_by_user_id); });

    const users = userIds.size > 0
      ? await this.userRepo.findByIds(Array.from(userIds))
      : [];
    const userMap = new Map(users.map(u => [u.id, u.full_name]));

    return {
      ...req,
      department_name: req.department?.name || null,
      created_by_name: userMap.get(req.created_by_user_id) || 'Unknown',
      employee_count: employees.length,
      employees,
      status_history: statusHistory.map(h => ({
        id: h.id,
        from_status: h.from_status,
        to_status: h.to_status,
        changed_by: userMap.get(h.changed_by_user_id!) || 'System',
        reason: h.reason,
        created_at: h.created_at,
      })),
    };
  }

  /* ────────────────── Create ────────────────── */

  async create(data: CreatePayload, userId: number): Promise<TransportRequest> {
    // Validate department exists
    const dept = await this.deptRepo.findOne({ where: { id: data.departmentId } });
    if (!dept) {
      throw new BadRequestException(`Department #${data.departmentId} not found`);
    }

    // Enforce daily lock: reject creation if the selected date is locked
    const dailyLock = await this.dailyRunRepo.findOne({ where: { run_date: data.requestDate as any } });
    if (dailyLock && [DailyRunStatus.LOCKED, DailyRunStatus.GROUPED, DailyRunStatus.ASSIGNING, DailyRunStatus.READY, DailyRunStatus.SUBMITTED_TO_HR, DailyRunStatus.HR_APPROVED, DailyRunStatus.DISPATCHED, DailyRunStatus.CLOSED].includes(dailyLock.status)) {
      throw new BadRequestException(`Cannot create a request for ${data.requestDate} — the daily run is locked.`);
    }

    const request = this.reqRepo.create({
      department_id: data.departmentId,
      request_date: data.requestDate as any,
      notes: data.notes?.trim() || undefined,
      ot_time: data.otTime || undefined,
      created_by_user_id: userId,
      status: RequestStatus.DRAFT,
    });

    const saved = await this.reqRepo.save(request);
    this.logger.log(`Request #${saved.id} created by user #${userId} for dept #${data.departmentId}`);
    return saved;
  }

  /* ────────────────── Update (editable until daily lock) ────────────────── */

  async update(id: number, data: { notes?: string; requestDate?: string; otTime?: string }): Promise<TransportRequest> {
    const req = await this.findOneOrFail(id);
    const editableStatuses = [RequestStatus.DRAFT, RequestStatus.SUBMITTED, RequestStatus.ADMIN_APPROVED, RequestStatus.ADMIN_REJECTED];
    if (!editableStatuses.includes(req.status)) {
      throw new BadRequestException(`Request cannot be edited in status "${req.status}". Editing is only allowed before daily lock.`);
    }

    const updateFields: any = {};
    if (data.notes !== undefined) updateFields.notes = data.notes.trim() || null;
    if (data.requestDate) updateFields.request_date = data.requestDate;
    if (data.otTime !== undefined) updateFields.ot_time = data.otTime || null;

    await this.reqRepo.update(id, updateFields);
    return this.findOneOrFail(id);
  }

  /* ────────────────── Add employees ────────────────── */

  async addEmployees(requestId: number, employeeIds: number[]): Promise<{ message: string; count: number }> {
    await this.findOneOrFail(requestId);

    // Remove existing then add fresh (idempotent)
    await this.reqEmpRepo.delete({ request_id: requestId });

    const entries = employeeIds.map(eid =>
      this.reqEmpRepo.create({ request_id: requestId, employee_id: eid }),
    );
    await this.reqEmpRepo.save(entries);

    this.logger.log(`Request #${requestId}: ${entries.length} employees assigned`);
    return { message: 'Employees added', count: entries.length };
  }

  /* ────────────────── Remove employees ────────────────── */

  async removeEmployees(requestId: number, employeeIds: number[]): Promise<{ message: string }> {
    const req = await this.findOneOrFail(requestId);
    if (req.status !== RequestStatus.DRAFT && req.status !== RequestStatus.SUBMITTED) {
      throw new BadRequestException('Cannot modify employees at this stage');
    }

    for (const eid of employeeIds) {
      await this.reqEmpRepo.delete({ request_id: requestId, employee_id: eid });
    }
    return { message: `${employeeIds.length} employee(s) removed` };
  }

  /* ────────────────── Status transitions ────────────────── */

  async submit(id: number, userId: number): Promise<TransportRequest> {
    // Verify at least one employee is assigned
    const empCount = await this.reqEmpRepo.count({ where: { request_id: id } });
    if (empCount === 0) {
      throw new BadRequestException('Cannot submit a request with no employees');
    }
    const req = await this.transition(id, RequestStatus.DRAFT, RequestStatus.SUBMITTED, userId);
    // Notify Admin/Super Admin: new transport request received
    this.notificationsService.notifyRole(
      [AppRole.ADMIN, AppRole.SUPER_ADMIN],
      'New Transport Request Received',
      `Transport request REQ-${String(id).padStart(4, '0')} has been submitted for approval.`,
      'REQUEST_SUBMITTED', 'TransportRequest', id,
    );
    return req;
  }

  async adminApprove(id: number, userId: number): Promise<TransportRequest> {
    const req = await this.transition(id, RequestStatus.SUBMITTED, RequestStatus.ADMIN_APPROVED, userId);
    await this.reqRepo.update(id, { admin_approved_by: userId, admin_approved_at: new Date() });
    await this.logApproval(id, 'ADMIN_APPROVE', userId);
    // Notify HOD: request approved by admin
    this.notificationsService.notifyUser(
      req.created_by_user_id,
      'Request Approved by Admin',
      `Your transport request REQ-${String(id).padStart(4, '0')} has been approved by admin.`,
      'ADMIN_APPROVED', 'TransportRequest', id,
    );
    return req;
  }

  async adminReject(id: number, userId: number, reason?: string): Promise<TransportRequest> {
    const req = await this.transition(id, RequestStatus.SUBMITTED, RequestStatus.ADMIN_REJECTED, userId, reason);
    await this.reqRepo.update(id, { rejection_reason: reason || undefined });
    await this.logApproval(id, 'ADMIN_REJECT', userId, reason);
    return req;
  }

  async lockDailyRun(id: number, userId: number): Promise<TransportRequest> {
    // Kept for backward compatibility — prefer using daily-lock/lock endpoint instead
    const req = await this.transition(id, RequestStatus.ADMIN_APPROVED, RequestStatus.DAILY_LOCKED, userId);
    await this.reqRepo.update(id, { daily_locked_by: userId, daily_locked_at: new Date() });
    return req;
  }

  async markTaProcessing(id: number, userId: number): Promise<TransportRequest> {
    return this.transition(id, RequestStatus.DAILY_LOCKED, RequestStatus.TA_PROCESSING, userId);
  }

  async markGroupingCompleted(id: number, userId: number): Promise<TransportRequest> {
    return this.transition(id, RequestStatus.TA_PROCESSING, RequestStatus.GROUPING_COMPLETED, userId);
  }

  async markTaCompleted(id: number, userId: number): Promise<TransportRequest> {
    // Allow from GROUPING_COMPLETED or TA_PROCESSING
    const req = await this.findOneOrFail(id);
    if (![RequestStatus.GROUPING_COMPLETED, RequestStatus.TA_PROCESSING].includes(req.status)) {
      throw new BadRequestException(`Cannot complete TA from status ${req.status}`);
    }
    return this.transition(id, req.status, RequestStatus.TA_COMPLETED, userId);
  }

  async hrApprove(id: number, userId: number): Promise<TransportRequest> {
    const req = await this.transition(id, RequestStatus.TA_COMPLETED, RequestStatus.HR_APPROVED, userId);
    await this.reqRepo.update(id, { hr_approved_by: userId, hr_approved_at: new Date() });
    await this.logApproval(id, 'HR_APPROVE', userId);

    // Sync DailyRun: if ALL requests in the daily run are now HR_APPROVED, update DailyRun status
    await this.syncDailyRunAfterHrApproval(req);

    return req;
  }

  async hrReject(id: number, userId: number, reason?: string): Promise<TransportRequest> {
    const req = await this.transition(id, RequestStatus.TA_COMPLETED, RequestStatus.HR_REJECTED, userId, reason);
    await this.reqRepo.update(id, { rejection_reason: reason || undefined });
    await this.logApproval(id, 'HR_REJECT', userId, reason);
    // Sync DailyRun — if all requests are processed (approved or rejected), update daily run
    await this.syncDailyRunAfterHrApproval(req);
    return req;
  }

  async dispatch(id: number, userId: number): Promise<TransportRequest> {
    const req = await this.transition(id, RequestStatus.HR_APPROVED, RequestStatus.DISPATCHED, userId);
    await this.syncDailyRunStatus(req, DailyRunStatus.DISPATCHED, RequestStatus.HR_APPROVED, RequestStatus.DISPATCHED);
    return req;
  }

  async close(id: number, userId: number): Promise<TransportRequest> {
    const req = await this.transition(id, RequestStatus.DISPATCHED, RequestStatus.CLOSED, userId);
    await this.syncDailyRunStatus(req, DailyRunStatus.CLOSED, RequestStatus.DISPATCHED, RequestStatus.CLOSED);
    return req;
  }

  async cancel(id: number, userId: number, reason?: string): Promise<TransportRequest> {
    const req = await this.findOneOrFail(id);
    if ([RequestStatus.DISPATCHED, RequestStatus.CLOSED, RequestStatus.ARCHIVED, RequestStatus.CANCELLED].includes(req.status)) {
      throw new BadRequestException(`Cannot cancel a ${req.status} request`);
    }
    return this.transition(id, req.status, RequestStatus.CANCELLED, userId, reason);
  }

  /* ────────────────── Private helpers ────────────────── */

  private async findOneOrFail(id: number): Promise<TransportRequest> {
    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException(`Transport request #${id} not found`);
    return req;
  }

  private async transition(
    id: number,
    expectedFrom: RequestStatus,
    to: RequestStatus,
    userId: number,
    reason?: string,
  ): Promise<TransportRequest> {
    const req = await this.findOneOrFail(id);

    if (req.status !== expectedFrom) {
      throw new BadRequestException(
        `Cannot transition from "${req.status}" to "${to}". Expected current status to be "${expectedFrom}".`,
      );
    }

    // Record history
    await this.historyRepo.save(
      this.historyRepo.create({
        request_id: id,
        from_status: req.status,
        to_status: to,
        changed_by_user_id: userId,
        reason,
      }),
    );

    await this.reqRepo.update(id, { status: to });
    this.logger.log(`Request #${id}: ${req.status} → ${to} by user #${userId}`);

    return this.findOneOrFail(id);
  }

  private async logApproval(requestId: number, action: string, userId: number, reason?: string): Promise<void> {
    await this.approvalRepo.save(
      this.approvalRepo.create({
        request_id: requestId,
        action,
        performed_by_user_id: userId,
        reason,
      }),
    );
  }

  /**
   * After HR approves/rejects a request, check if ALL requests in the same daily run
   * are now HR_APPROVED (or HR_REJECTED). If so, update DailyRun status to HR_APPROVED.
   */
  private async syncDailyRunAfterHrApproval(req: TransportRequest): Promise<void> {
    try {
      const requestDate = req.request_date;
      const dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: requestDate } });
      if (!dailyRun) return;
      // Allow sync from any active status (not just SUBMITTED_TO_HR)
      // because workflow may skip steps or HR may approve directly
      const syncableStatuses = [
        DailyRunStatus.SUBMITTED_TO_HR, DailyRunStatus.READY,
        DailyRunStatus.GROUPED, DailyRunStatus.ASSIGNING,
        DailyRunStatus.LOCKED,
      ];
      if (!syncableStatuses.includes(dailyRun.status)) return;

      // Check if any requests for this date are still TA_COMPLETED (pending HR approval)
      const pendingCount = await this.reqRepo.count({
        where: { request_date: requestDate, status: RequestStatus.TA_COMPLETED },
      });

      if (pendingCount === 0) {
        // All requests are approved (or rejected) — mark daily run as HR_APPROVED
        const approvedCount = await this.reqRepo.count({
          where: { request_date: requestDate, status: RequestStatus.HR_APPROVED },
        });
        if (approvedCount > 0) {
          await this.dailyRunRepo.update(dailyRun.id, { status: DailyRunStatus.HR_APPROVED });
          this.logger.log(`DailyRun #${dailyRun.id} for ${requestDate}: all requests HR processed → HR_APPROVED`);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to sync DailyRun after HR approval: ${err.message}`);
    }
  }

  /**
   * Generic DailyRun status sync after dispatch/close transitions.
   * When all requests for a date have transitioned to targetRequestStatus,
   * update the DailyRun to targetRunStatus.
   */
  private async syncDailyRunStatus(
    req: TransportRequest,
    targetRunStatus: DailyRunStatus,
    previousRequestStatus: RequestStatus,
    targetRequestStatus: RequestStatus,
  ): Promise<void> {
    try {
      const requestDate = req.request_date;
      const dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: requestDate } });
      if (!dailyRun) return;

      // Check if any requests still in the previous status
      const pendingCount = await this.reqRepo.count({
        where: { request_date: requestDate, status: previousRequestStatus },
      });

      if (pendingCount === 0) {
        const targetCount = await this.reqRepo.count({
          where: { request_date: requestDate, status: targetRequestStatus },
        });
        if (targetCount > 0) {
          await this.dailyRunRepo.update(dailyRun.id, { status: targetRunStatus });
          this.logger.log(`DailyRun #${dailyRun.id} for ${requestDate}: → ${targetRunStatus}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to sync DailyRun status: ${err.message}`);
    }
  }
}
