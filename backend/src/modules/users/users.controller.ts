import { Controller, Get, Patch, Delete, Param, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PaginationDto } from '../../common/dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';
import { UpdateUserDto } from './dto/user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateUserDto) {
    return this.service.update(id, data);
  }

  @Patch(':id/suspend')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  suspend(@Param('id', ParseIntPipe) id: number) {
    return this.service.suspend(id);
  }

  @Patch(':id/reactivate')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.service.reactivate(id);
  }

  @Patch(':id/reset-password')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  resetPassword(@Param('id', ParseIntPipe) id: number, @Body('newPassword') newPassword: string) {
    return this.service.adminResetPassword(id, newPassword);
  }

  @Delete(':id')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
