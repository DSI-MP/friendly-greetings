import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { PaginationDto } from '../../common/dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';
import { CreateRouteDto, UpdateRouteDto, CreateCorridorDto, UpdateCorridorDto } from './dto/route.dto';

@ApiTags('Routes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class RoutesController {
  constructor(private service: RoutesService) {}

  @Get('routes')
  findAllRoutes(@Query() query: PaginationDto) { return this.service.findAllRoutes(query); }

  @Post('routes')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  createRoute(@Body() data: CreateRouteDto) { return this.service.createRoute(data); }

  @Patch('routes/:id')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  updateRoute(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateRouteDto) { return this.service.updateRoute(id, data); }

  @Get('corridors')
  findAllCorridors(@Query() query: PaginationDto) { return this.service.findAllCorridors(query); }

  @Post('corridors')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  createCorridor(@Body() data: CreateCorridorDto) { return this.service.createCorridor(data); }

  @Patch('corridors/:id')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  updateCorridor(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateCorridorDto) { return this.service.updateCorridor(id, data); }
}
