import { Controller, Get, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { PaginationDto } from '../../common/dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private service: AuditService) {}

  @Get()
  findAll(@Query() query: PaginationDto) { return this.service.findAll(query); }

  @Get(':entity/:id')
  findByEntity(@Param('entity') entity: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.findByEntity(entity, id);
  }
}
