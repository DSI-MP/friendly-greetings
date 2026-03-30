import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { GeneratedRouteGroup, GeneratedRouteGroupMember, RouteGroupRun } from '../grouping/grouping.entity';
import { TransportRequest, TransportRequestEmployee } from '../transport-requests/transport-request.entity';
import { DailyRun } from '../daily-lock/daily-run.entity';
import { Employee } from '../employees/employee.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Department } from '../departments/department.entity';
import { Place } from '../places/place.entity';
import { SystemSetting } from '../settings/settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    GeneratedRouteGroup, GeneratedRouteGroupMember, RouteGroupRun,
    TransportRequest, TransportRequestEmployee, DailyRun, Employee, Vehicle, Department, Place,
    SystemSetting,
  ])],
  controllers: [ReportsController],
})
export class ReportsModule {}
