import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransportRequestsService } from './transport-requests.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';
import {
  CreateTransportRequestDto,
  UpdateTransportRequestDto,
  AddEmployeesDto,
  RejectDto,
  ListTransportRequestsDto,
} from './dto/create-transport-request.dto';

@ApiTags('Transport Requests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('transport-requests')
export class TransportRequestsController {
  constructor(private readonly service: TransportRequestsService) {}

  /* ────────────────── List ────────────────── */

  @Get()
  findAll(@Query() query: ListTransportRequestsDto, @CurrentUser() user: any) {
    // HOD can only see their own department
    const departmentId = user.role === AppRole.HOD
      ? Number(user.departmentId) || undefined
      : query.departmentId;

    return this.service.findAll({
      ...query,
      departmentId,
    });
  }

  /* ────────────────── Detail ────────────────── */

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  /* ────────────────── Create ────────────────── */

  @Post()
  @Roles(AppRole.HOD, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  create(@Body() data: CreateTransportRequestDto, @CurrentUser() user: any) {
    const departmentId = this.resolveDepartmentId(data, user);

    return this.service.create(
      {
        departmentId,
        requestDate: data.requestDate,
        notes: data.notes,
        otTime: data.otTime,
      },
      user.id ?? user.sub,
    );
  }

  /* ────────────────── Update (draft only) ────────────────── */

  @Patch(':id')
  @Roles(AppRole.HOD, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateTransportRequestDto) {
    return this.service.update(id, data);
  }

  /* ────────────────── Employee management ────────────────── */

  @Post(':id/add-employees')
  @Roles(AppRole.HOD, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  addEmployees(@Param('id', ParseIntPipe) id: number, @Body() data: AddEmployeesDto) {
    return this.service.addEmployees(id, data.employeeIds);
  }

  @Post(':id/remove-employees')
  @Roles(AppRole.HOD, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  removeEmployees(@Param('id', ParseIntPipe) id: number, @Body() data: AddEmployeesDto) {
    return this.service.removeEmployees(id, data.employeeIds);
  }

  /* ────────────────── Workflow transitions ────────────────── */

  @Post(':id/submit')
  @Roles(AppRole.HOD)
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.service.submit(id, userId);
  }

  @Post(':id/admin-approve')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  adminApprove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.service.adminApprove(id, userId);
  }

  @Post(':id/admin-reject')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  adminReject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Body() data: RejectDto,
  ) {
    return this.service.adminReject(id, userId, data.reason);
  }

  @Post(':id/lock-daily-run')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  lockDailyRun(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.service.lockDailyRun(id, userId);
  }

  @Post(':id/ta-processing')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  markTaProcessing(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.service.markTaProcessing(id, userId);
  }

  @Post(':id/ta-completed')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  markTaCompleted(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.service.markTaCompleted(id, userId);
  }

  @Post(':id/hr-approve')
  @Roles(AppRole.HR, AppRole.SUPER_ADMIN)
  hrApprove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.service.hrApprove(id, userId);
  }

  @Post(':id/hr-reject')
  @Roles(AppRole.HR, AppRole.SUPER_ADMIN)
  hrReject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Body() data: RejectDto,
  ) {
    return this.service.hrReject(id, userId, data.reason);
  }

  @Post(':id/dispatch')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  dispatch(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.service.dispatch(id, userId);
  }

  @Post(':id/close')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  close(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.service.close(id, userId);
  }

  @Post(':id/cancel')
  @Roles(AppRole.HOD, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Body() data: RejectDto,
  ) {
    return this.service.cancel(id, userId, data.reason);
  }

  /* ────────────────── Helpers ────────────────── */

  private resolveDepartmentId(data: CreateTransportRequestDto, user: any): number {
    if (user.role === AppRole.HOD) {
      const deptId = Number(user.departmentId);
      if (!deptId) throw new BadRequestException('HOD has no department assigned');
      return deptId;
    }

    // Admin/Super Admin must provide departmentId explicitly
    const deptId = Number(data.departmentId);
    if (!deptId) throw new BadRequestException('departmentId is required for admin requests');
    return deptId;
  }
}
