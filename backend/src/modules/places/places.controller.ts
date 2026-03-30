import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlacesService } from './places.service';
import { PaginationDto } from '../../common/dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';
import { CreatePlaceDto, UpdatePlaceDto } from './dto/place.dto';

@ApiTags('Places')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('places')
export class PlacesController {
  constructor(private service: PlacesService) {}

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }

  @Post()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  create(@Body() data: CreatePlaceDto) {
    return this.service.create(data);
  }

  @Patch(':id')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdatePlaceDto) {
    return this.service.update(id, data);
  }

  @Post('import')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  importPlaces(@Body() body: { items: any[] }, @CurrentUser('id') userId: number) {
    return this.service.importFromJson(body.items, userId);
  }
}

// Public controller for unauthenticated places list (used by self-register)
@ApiTags('Public')
@Controller('public')
export class PublicPlacesController {
  constructor(private service: PlacesService) {}

  @Get('places')
  findAllPublic() {
    return this.service.findAllPublic();
  }
}
