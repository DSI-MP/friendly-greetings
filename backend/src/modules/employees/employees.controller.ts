import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseIntPipe, UploadedFile, UseInterceptors, BadRequestException, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LoginThrottleGuard } from '../auth/auth.guard.throttle';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { BulkUploadService } from './bulk-upload.service';
import { SelfRegisterDto, CreateEmployeeDto, LocationChangeRequestDto } from './dto/employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';
import * as XLSX from 'xlsx';
import { Response } from 'express';

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(
    private service: EmployeesService,
    private bulkUploadService: BulkUploadService,
  ) {}

  // Public endpoint: self-register (rate limited)
  @Post('self-register')
  @UseGuards(LoginThrottleGuard)
  selfRegister(@Body() dto: SelfRegisterDto) {
    return this.service.selfRegister(dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HOD, AppRole.HR, AppRole.PLANNING)
  findAll(@Query() query: ListEmployeesDto, @CurrentUser() user: any) {
    const deptId = user.role === AppRole.HOD
      ? Number(user.departmentId) || undefined
      : query.departmentId ? Number(query.departmentId) : undefined;
    return this.service.findAll(query, deptId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HOD)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateEmployeeDto, @CurrentUser() user: any) {
    return this.service.update(id, data, user);
  }

  @Get('pending-self-registrations')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HOD)
  getPending(@CurrentUser() user: any) {
    const deptId = user.role === AppRole.HOD ? Number(user.departmentId) || undefined : undefined;
    return this.service.getPendingSelfRegistrations(deptId);
  }

  @Post(':id/approve-self-registration')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HOD)
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.service.approveSelfRegistration(id);
  }

  @Post(':id/location-change-request')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  locationChange(@Param('id', ParseIntPipe) id: number, @Body() dto: LocationChangeRequestDto) {
    return { message: 'Location change request submitted', employeeId: id };
  }

  @Get('export/excel')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HR)
  async exportExcel(
    @Query('departmentIds') departmentIds: string,
    @Res() res: Response,
  ) {
    if (!departmentIds) throw new BadRequestException('At least one department must be selected');
    const ids = departmentIds.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) throw new BadRequestException('Invalid department IDs');

    const data = await this.service.getEmployeesForExport(ids);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=employees_export.xlsx');
    res.send(buf);
  }

  @Post('bulk-upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.HOD)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      const allowedMime = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream',
      ];
      const allowedExt = /\.xlsx?$/i;
      if (allowedMime.includes(file.mimetype) || allowedExt.test(file.originalname)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`Only .xlsx and .xls files are allowed (received mimetype: ${file.mimetype}, filename: ${file.originalname})`), false);
      }
    },
  }))
  async bulkUpload(@UploadedFile() file: any, @CurrentUser() user: any) {
    if (!file) throw new BadRequestException('File is required');

    const departmentId = Number(user.departmentId);
    if (!departmentId || isNaN(departmentId)) throw new BadRequestException('HOD must be assigned to a department');
    
    const userId = Number(user.sub ?? user.id);
    if (!userId || isNaN(userId)) throw new BadRequestException('Invalid user');

    const workbook = XLSX.read(file.buffer, { type: 'buffer', raw: false, cellText: true, cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Excel file is empty');

    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      raw: false,
      defval: '',
      blankrows: false,
    });
    if (rows.length === 0) throw new BadRequestException('No data rows found in Excel file');
    if (rows.length > 1000) throw new BadRequestException('Maximum 1000 rows per upload');

    return this.bulkUploadService.processBulkUpload(rows, departmentId, userId);
  }
}
