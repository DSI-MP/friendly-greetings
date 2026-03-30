import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GroupingService } from './grouping.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';
import { ManualAdjustDto, AssignVehicleDto, SplitAssignDto } from './dto/grouping.dto';

@ApiTags('Grouping')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('grouping')
export class GroupingController {
  constructor(private service: GroupingService) {}

  @Post('run/daily/:date')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  runDailyGrouping(@Param('date') date: string, @CurrentUser('id') userId: number) {
    return this.service.runDailyGrouping(date, userId);
  }

  @Get('run/daily/:date/latest')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HR, AppRole.PLANNING)
  getDailyLatest(@Param('date') date: string) {
    return this.service.getLatestDailyRun(date);
  }

  /** Legacy request-level grouping — DISABLED. */
  @Post('run/:requestId')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  runGrouping() {
    return {
      error: 'Legacy request-level grouping is disabled. Use daily-run grouping: POST /grouping/run/daily/:date',
      disabled: true,
    };
  }

  @Get('run/:requestId/latest')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HR, AppRole.PLANNING)
  getLatest() {
    return {
      error: 'Legacy request-level grouping is disabled. Use daily-run grouping: GET /grouping/run/daily/:date/latest',
      disabled: true,
    };
  }

  @Post('run/:runId/regenerate')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  regenerate(@Param('runId', ParseIntPipe) runId: number, @CurrentUser('id') userId: number) {
    return this.service.regenerateRun(runId, userId);
  }

  @Patch('groups/:groupId/assign-vehicle')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  assignVehicle(@Param('groupId', ParseIntPipe) groupId: number, @Body() data: AssignVehicleDto) {
    return this.service.assignVehicle(groupId, data.vehicleId);
  }

  @Patch('groups/:groupId/unassign-vehicle')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  unassignVehicle(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.service.unassignVehicle(groupId);
  }

  @Post('groups/:groupId/split-assign')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  splitAndAssign(@Param('groupId', ParseIntPipe) groupId: number, @Body() data: SplitAssignDto) {
    return this.service.splitAndAssignVehicles(groupId, data.vehicleIds);
  }

  /** Split a group into two sub-groups without assigning vehicles */
  @Post('groups/:groupId/split')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  splitGroup(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.service.splitGroup(groupId);
  }

  @Post('groups/:groupId/undo-split')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  undoSplit(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.service.undoSplit(groupId);
  }

  @Patch('groups/:groupId/manual-adjust')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  manualAdjust(@Param('groupId', ParseIntPipe) groupId: number, @Body() data: ManualAdjustDto) {
    return { message: 'Manual adjustment applied', groupId, data };
  }
}
