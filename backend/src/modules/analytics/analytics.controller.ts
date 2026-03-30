import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  @Get('costs')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.PLANNING, AppRole.HR)
  async costs(@Query('month') month?: string) {
    return { analytics: 'costs', month, data: [] };
  }

  @Get('utilization')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.PLANNING, AppRole.TRANSPORT_AUTHORITY)
  async utilization(@Query('month') month?: string) {
    return { analytics: 'utilization', month, data: [] };
  }
}
