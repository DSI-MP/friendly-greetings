import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlacesController, PublicPlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { Place, GnDivision } from './place.entity';
import { ImportLog } from '../settings/settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Place, GnDivision, ImportLog])],
  controllers: [PlacesController, PublicPlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
