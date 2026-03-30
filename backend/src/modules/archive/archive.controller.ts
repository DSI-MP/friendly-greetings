import { Controller, Post, Get, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyCloseBatch, MonthlyCloseBatch, ArchiveExport } from '../settings/settings.entity';
import { TransportRequest } from '../transport-requests/transport-request.entity';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole, RequestStatus } from '../../common/enums';

@ApiTags('Archive')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('archive')
export class ArchiveController {
  constructor(
    @InjectRepository(DailyCloseBatch) private dailyRepo: Repository<DailyCloseBatch>,
    @InjectRepository(MonthlyCloseBatch) private monthlyRepo: Repository<MonthlyCloseBatch>,
    @InjectRepository(ArchiveExport) private exportRepo: Repository<ArchiveExport>,
    @InjectRepository(TransportRequest) private reqRepo: Repository<TransportRequest>,
  ) {}

  @Post('daily-close/:date')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  async dailyClose(@Param('date') date: string, @CurrentUser('id') userId: number) {
    const requests = await this.reqRepo.find({ where: { request_date: date as any, status: RequestStatus.HR_APPROVED } });
    for (const req of requests) {
      await this.reqRepo.update(req.id, { status: RequestStatus.CLOSED });
    }
    const batch = await this.dailyRepo.save({
      close_date: date, closed_by_user_id: userId, requests_closed: requests.length,
    });
    return { message: `Daily close completed for ${date}`, batch };
  }

  @Post('monthly-close/:month')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  async monthlyClose(@Param('month') month: string, @CurrentUser('id') userId: number) {
    const closedRequests = await this.reqRepo.count({ where: { status: RequestStatus.CLOSED } });
    const batch = await this.monthlyRepo.save({
      close_month: month, closed_by_user_id: userId, requests_archived: closedRequests,
    });
    return { message: `Monthly close completed for ${month}`, batch };
  }

  @Get('exports')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  async getExports() {
    return this.exportRepo.find({ order: { created_at: 'DESC' } });
  }
}
