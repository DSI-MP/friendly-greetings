import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseIntPipe, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { BulkVehicleUploadService } from './bulk-vehicle-upload.service';
import { PaginationDto } from '../../common/dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import * as XLSX from 'xlsx';

@ApiTags('Vehicles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private service: VehiclesService,
    private bulkUploadService: BulkVehicleUploadService,
  ) {}

  @Get()
  findAll(@Query() query: PaginationDto) { return this.service.findAll(query); }

  @Post()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  create(@Body() data: CreateVehicleDto) { return this.service.create(data); }

  @Patch(':id')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateVehicleDto) { return this.service.update(id, data); }

  @Post('bulk-upload')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
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
        cb(new BadRequestException(`Only .xlsx and .xls files are allowed (received: ${file.mimetype})`), false);
      }
    },
  }))
  async bulkUpload(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('File is required');

    const workbook = XLSX.read(file.buffer, { type: 'buffer', raw: false, cellText: true, cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Excel file is empty');

    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      raw: false, defval: '', blankrows: false,
    });
    if (rows.length === 0) throw new BadRequestException('No data rows found');
    if (rows.length > 500) throw new BadRequestException('Maximum 500 vehicles per upload');

    return this.bulkUploadService.processBulkUpload(rows);
  }
}
