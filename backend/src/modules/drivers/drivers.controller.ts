import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { PaginationDto } from '../../common/dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';
import { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto';

@ApiTags('Drivers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('drivers')
export class DriversController {
  constructor(private service: DriversService) {}

  @Get()
  findAll(@Query() query: PaginationDto) { return this.service.findAll(query); }

  @Post()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  create(@Body() data: CreateDriverDto) { return this.service.create(data); }

  @Patch(':id')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateDriverDto) { return this.service.update(id, data); }
}
