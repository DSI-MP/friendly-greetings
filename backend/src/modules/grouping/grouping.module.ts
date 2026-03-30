import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupingController } from './grouping.controller';
import { GroupingService } from './grouping.service';
import {
  RouteGroupRun, GeneratedRouteGroup, GeneratedRouteGroupMember,
  AssignmentException, GroupVehicleAssignment, TripManifest, BoardingEvent, TripIncident,
} from './grouping.entity';
import { DailyRun } from '../daily-lock/daily-run.entity';
import { TransportRequest, TransportRequestEmployee } from '../transport-requests/transport-request.entity';
import { Employee } from '../employees/employee.entity';
import { Place } from '../places/place.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RouteGroupRun, GeneratedRouteGroup, GeneratedRouteGroupMember,
      AssignmentException, GroupVehicleAssignment, TripManifest, BoardingEvent, TripIncident,
      DailyRun,
      TransportRequest, TransportRequestEmployee, Employee, Place, Vehicle,
    ]),
    RoutingModule,
  ],
  controllers: [GroupingController],
  providers: [GroupingService],
  exports: [GroupingService],
})
export class GroupingModule {}
