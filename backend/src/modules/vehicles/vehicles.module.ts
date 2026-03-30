import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { BulkVehicleUploadService } from './bulk-vehicle-upload.service';
import { Vehicle, VehicleTypeEntity, VehicleCostProfile } from './vehicle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, VehicleTypeEntity, VehicleCostProfile])],
  controllers: [VehiclesController],
  providers: [VehiclesService, BulkVehicleUploadService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
