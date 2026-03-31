import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SelfServiceController } from './self-service.controller';
import { SelfServiceService } from './self-service.service';
import { LocationChangeRequest } from './location-change-request.entity';
import { Employee } from '../employees/employee.entity';
import { Place } from '../places/place.entity';
import { TransportRequest, TransportRequestEmployee } from '../transport-requests/transport-request.entity';
import { GeneratedRouteGroup, GeneratedRouteGroupMember, RouteGroupRun } from '../grouping/grouping.entity';
import { DailyRun } from '../daily-lock/daily-run.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Department } from '../departments/department.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    LocationChangeRequest, Employee, Place,
    TransportRequest, TransportRequestEmployee,
    GeneratedRouteGroup, GeneratedRouteGroupMember, RouteGroupRun,
    DailyRun, Vehicle, Department,
  ])],
  controllers: [SelfServiceController],
  providers: [SelfServiceService],
})
export class SelfServiceModule {}
