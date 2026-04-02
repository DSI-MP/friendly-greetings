import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DailyLock } from './daily-lock.entity';
import { DailyRun, DailyRunStatus } from './daily-run.entity';
import { TransportRequest, TransportRequestEmployee } from '../transport-requests/transport-request.entity';
import { GeneratedRouteGroup, GeneratedRouteGroupMember } from '../grouping/grouping.entity';
import { RequestStatus } from '../../common/enums';

@Injectable()
export class DailyLockService {
  private readonly logger = new Logger(DailyLockService.name);

  constructor(
    @InjectRepository(DailyLock) private lockRepo: Repository<DailyLock>,
    @InjectRepository(DailyRun) private dailyRunRepo: Repository<DailyRun>,
    @InjectRepository(TransportRequest) private reqRepo: Repository<TransportRequest>,
    @InjectRepository(TransportRequestEmployee) private reqEmpRepo: Repository<TransportRequestEmployee>,
    @InjectRepository(GeneratedRouteGroup) private groupRepo: Repository<GeneratedRouteGroup>,
    @InjectRepository(GeneratedRouteGroupMember) private memberRepo: Repository<GeneratedRouteGroupMember>,
  ) {}

  async getStatus(date: string): Promise<{
    date: string;
    isLocked: boolean;
    lockedAt?: Date;
    lockedByUserId?: number;
    lockedRequestCount?: number;
    totalEmployeeCount?: number;
    approvedRequestCount?: number;
    dailyRunId?: number;
    dailyRunStatus?: string;
  }> {
    const lock = await this.lockRepo.findOne({ where: { lock_date: date as any } });
    const dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: date as any } });

    const approvedCount = await this.reqRepo.count({
      where: { request_date: date as any, status: RequestStatus.ADMIN_APPROVED },
    });

    // Compute live employee total from approved/locked requests if lock snapshot is 0
    let totalEmployeeCount = lock?.total_employee_count ?? 0;
    if (totalEmployeeCount === 0) {
      const relevantRequests = await this.reqRepo.find({
        where: { request_date: date as any, status: In([RequestStatus.ADMIN_APPROVED, RequestStatus.DAILY_LOCKED, RequestStatus.TA_PROCESSING, RequestStatus.GROUPING_COMPLETED, RequestStatus.TA_COMPLETED, RequestStatus.HR_APPROVED]) },
        select: ['id'],
      });
      if (relevantRequests.length > 0) {
        for (const req of relevantRequests) {
          const count = await this.reqEmpRepo.count({ where: { request_id: req.id } });
          totalEmployeeCount += count;
        }
      }
    }

    return {
      date,
      isLocked: lock?.is_locked ?? false,
      lockedAt: lock?.locked_at,
      lockedByUserId: lock?.locked_by_user_id,
      lockedRequestCount: lock?.locked_request_count ?? 0,
      totalEmployeeCount,
      approvedRequestCount: approvedCount,
      dailyRunId: dailyRun?.id,
      dailyRunStatus: dailyRun?.status,
    };
  }

  async lock(date: string, userId: number): Promise<{
    message: string;
    date: string;
    lockedRequestCount: number;
    totalEmployeeCount: number;
    lockedRequestIds: number[];
    dailyRunId: number;
  }> {
    if (!date) throw new BadRequestException('Date is required');

    const existing = await this.lockRepo.findOne({ where: { lock_date: date as any } });
    if (existing && existing.is_locked) {
      throw new BadRequestException(`Date ${date} is already locked`);
    }

    const approvedRequests = await this.reqRepo.find({
      where: { request_date: date as any, status: RequestStatus.ADMIN_APPROVED },
    });

    if (approvedRequests.length === 0) {
      throw new BadRequestException(`No approved requests found for ${date}. Approve requests first before locking.`);
    }

    const requestIds = approvedRequests.map(r => r.id);
    const departmentIds = [...new Set(approvedRequests.map(r => r.department_id))];
    let totalEmployees = 0;
    for (const reqId of requestIds) {
      const count = await this.reqEmpRepo.count({ where: { request_id: reqId } });
      totalEmployees += count;
    }

    // Transition all approved requests to DAILY_LOCKED
    for (const req of approvedRequests) {
      await this.reqRepo.update(req.id, {
        status: RequestStatus.DAILY_LOCKED,
        daily_locked_by: userId,
        daily_locked_at: new Date(),
      });
    }

    // Create or update daily lock record
    if (existing) {
      await this.lockRepo.update(existing.id, {
        is_locked: true,
        locked_by_user_id: userId,
        locked_at: new Date(),
        locked_request_count: approvedRequests.length,
        total_employee_count: totalEmployees,
        unlocked_by_user_id: undefined,
        unlocked_at: undefined,
      });
    } else {
      await this.lockRepo.save(this.lockRepo.create({
        lock_date: date as any,
        is_locked: true,
        locked_by_user_id: userId,
        locked_at: new Date(),
        locked_request_count: approvedRequests.length,
        total_employee_count: totalEmployees,
      }));
    }

    // Create DailyRun entity
    let dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: date as any } });
    if (!dailyRun) {
      dailyRun = await this.dailyRunRepo.save(this.dailyRunRepo.create({
        run_date: date as any,
        status: DailyRunStatus.LOCKED,
        included_request_ids: requestIds,
        request_count: requestIds.length,
        department_count: departmentIds.length,
        total_employees: totalEmployees,
        locked_by: userId,
        locked_at: new Date(),
        created_by: userId,
      }));
    } else {
      await this.dailyRunRepo.update(dailyRun.id, {
        status: DailyRunStatus.LOCKED,
        included_request_ids: requestIds,
        request_count: requestIds.length,
        department_count: departmentIds.length,
        total_employees: totalEmployees,
        locked_by: userId,
        locked_at: new Date(),
      });
      dailyRun = (await this.dailyRunRepo.findOne({ where: { id: dailyRun.id } }))!;
    }

    this.logger.log(`Daily lock for ${date}: ${approvedRequests.length} requests, ${totalEmployees} employees, ${departmentIds.length} departments locked by user #${userId}`);

    return {
      message: `Daily run locked for ${date}: ${approvedRequests.length} requests with ${totalEmployees} employees`,
      date,
      lockedRequestCount: approvedRequests.length,
      totalEmployeeCount: totalEmployees,
      lockedRequestIds: requestIds,
      dailyRunId: dailyRun.id,
    };
  }

  async unlock(date: string, userId: number): Promise<{ message: string; date: string }> {
    if (!date) throw new BadRequestException('Date is required');

    const lock = await this.lockRepo.findOne({ where: { lock_date: date as any } });
    if (!lock || !lock.is_locked) {
      throw new BadRequestException(`Date ${date} is not locked`);
    }

    const lockedRequests = await this.reqRepo.find({
      where: { request_date: date as any, status: RequestStatus.DAILY_LOCKED },
    });
    for (const req of lockedRequests) {
      await this.reqRepo.update(req.id, {
        status: RequestStatus.ADMIN_APPROVED,
        daily_locked_by: undefined,
        daily_locked_at: undefined,
      });
    }

    await this.lockRepo.update(lock.id, {
      is_locked: false,
      unlocked_by_user_id: userId,
      unlocked_at: new Date(),
    });

    // Update DailyRun status
    const dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: date as any } });
    if (dailyRun) {
      await this.dailyRunRepo.update(dailyRun.id, { status: DailyRunStatus.OPEN });
    }

    this.logger.log(`Daily unlock for ${date}: ${lockedRequests.length} requests reverted by user #${userId}`);
    return { message: `Daily run unlocked for ${date}`, date };
  }

  async isLocked(date: string): Promise<boolean> {
    const lock = await this.lockRepo.findOne({ where: { lock_date: date as any } });
    return lock?.is_locked ?? false;
  }

  async getLockedDates(): Promise<any[]> {
    const locks = await this.lockRepo.find({
      where: { is_locked: true },
      order: { lock_date: 'DESC' },
    });

    // Enrich with DailyRun info
    const result = [];
    for (const lock of locks) {
      const dateStr = typeof lock.lock_date === 'string' ? lock.lock_date : (lock.lock_date as any)?.toISOString?.()?.split('T')[0] || String(lock.lock_date);
      const dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: lock.lock_date } });
      result.push({
        ...lock,
        daily_run_id: dailyRun?.id,
        daily_run_status: dailyRun?.status,
        department_count: dailyRun?.department_count ?? 0,
        total_groups: dailyRun?.total_groups ?? 0,
      });
    }
    return result;
  }

  async getLockedRequestIds(date: string): Promise<number[]> {
    const requests = await this.reqRepo.find({
      where: { request_date: date as any, status: In([RequestStatus.DAILY_LOCKED, RequestStatus.TA_PROCESSING, RequestStatus.GROUPING_COMPLETED, RequestStatus.TA_COMPLETED, RequestStatus.HR_APPROVED, RequestStatus.DISPATCHED]) },
      select: ['id'],
    });
    return requests.map(r => r.id);
  }

  async submitDailyToHr(date: string, userId: number): Promise<{ message: string; date: string; updatedCount: number }> {
    if (!date) throw new BadRequestException('Date is required');

    const lock = await this.lockRepo.findOne({ where: { lock_date: date as any } });
    if (!lock || !lock.is_locked) {
      throw new BadRequestException(`Date ${date} is not locked`);
    }

    const requests = await this.reqRepo.find({
      where: { request_date: date as any, status: In([RequestStatus.DAILY_LOCKED, RequestStatus.TA_PROCESSING, RequestStatus.GROUPING_COMPLETED]) },
    });

    if (requests.length === 0) {
      throw new BadRequestException(`No grouped/processing requests found for ${date}. Run grouping first.`);
    }

    // ── Grouping integrity check: reject if duplicate employees in generated groups ──
    const dailyRun = await this.dailyRunRepo.findOne({ where: { run_date: date as any } });
    if (dailyRun?.latest_run_id) {
      const groups = await this.groupRepo.find({ where: { run_id: dailyRun.latest_run_id } });
      if (groups.length > 0) {
        const groupIds = groups.map(g => g.id);
        const allMembers = await this.memberRepo.find({ where: { generated_group_id: In(groupIds) } });
        const seenEmployees = new Set<number>();
        const duplicates: number[] = [];
        for (const m of allMembers) {
          if (seenEmployees.has(m.employee_id)) duplicates.push(m.employee_id);
          seenEmployees.add(m.employee_id);
        }
        if (duplicates.length > 0) {
          this.logger.error(`Grouping integrity failure for ${date}: duplicate employee IDs [${duplicates.join(',')}] in generated groups`);
          throw new BadRequestException(
            `Cannot submit to HR: ${duplicates.length} employee(s) appear in multiple groups. Re-run grouping to fix.`,
          );
        }
        // Validate employee_count matches actual members
        for (const g of groups) {
          const actual = allMembers.filter(m => m.generated_group_id === g.id).length;
          if (actual !== g.employee_count) {
            this.logger.warn(`Group ${g.group_code} employee_count mismatch: stored=${g.employee_count}, actual=${actual}`);
          }
        }
      }
    }

    for (const req of requests) {
      await this.reqRepo.update(req.id, { status: RequestStatus.TA_COMPLETED });
    }

    // Update DailyRun (reuse variable from integrity check above)
    const dailyRunForUpdate = dailyRun ?? await this.dailyRunRepo.findOne({ where: { run_date: date as any } });
    if (dailyRunForUpdate) {
      await this.dailyRunRepo.update(dailyRunForUpdate.id, {
        status: DailyRunStatus.SUBMITTED_TO_HR,
        submitted_to_hr_at: new Date(),
      });
    }

    this.logger.log(`Daily submit to HR for ${date}: ${requests.length} requests marked TA_COMPLETED by user #${userId}`);

    return {
      message: `${requests.length} request(s) for ${date} submitted to HR for final approval`,
      date,
      updatedCount: requests.length,
    };
  }
}
