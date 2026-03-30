import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DailyLockService } from './daily-lock.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';

@ApiTags('Daily Lock')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('daily-lock')
export class DailyLockController {
  constructor(private service: DailyLockService) {}

  /** Check lock status for a date. Returns approved request count too. */
  @Get('status')
  getStatus(@Query('date') date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.service.getStatus(targetDate);
  }

  /** Lock ALL admin-approved requests for a date — Admin/Super Admin only */
  @Post('lock')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  lock(@Body('date') date: string, @CurrentUser('id') userId: number) {
    return this.service.lock(date, userId);
  }

  /** Unlock a date — Admin/Super Admin only */
  @Post('unlock')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  unlock(@Body('date') date: string, @CurrentUser('id') userId: number) {
    return this.service.unlock(date, userId);
  }

  /** Get all locked dates for TA dashboard */
  @Get('locked-dates')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HR, AppRole.PLANNING)
  getLockedDates() {
    return this.service.getLockedDates();
  }

  /** Get locked request IDs for a specific date */
  @Get('requests')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HR, AppRole.PLANNING)
  getLockedRequests(@Query('date') date: string) {
    return this.service.getLockedRequestIds(date);
  }

  /** Submit entire daily batch to HR — marks all grouped requests for the date as TA_COMPLETED */
  @Post('submit-to-hr')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  submitToHr(@Body('date') date: string, @CurrentUser('id') userId: number) {
    return this.service.submitDailyToHr(date, userId);
  }
}
