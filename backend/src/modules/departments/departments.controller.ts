import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { PaginationDto } from '../../common/dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@ApiTags('Departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private service: DepartmentsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HR, AppRole.PLANNING)
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  create(@Body() data: CreateDepartmentDto) {
    return this.service.create(data);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateDepartmentDto) {
    return this.service.update(id, data);
  }
}

// Public controller for unauthenticated department list
@ApiTags('Public')
@Controller('public')
export class PublicDepartmentsController {
  constructor(private service: DepartmentsService) {}

  @Get('departments')
  findAllPublic() {
    return this.service.findAllPublic();
  }
}
