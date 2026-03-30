import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';
import { getTypeOrmConfig } from './config/typeorm.config';
import { GlobalExceptionFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { PlacesModule } from './modules/places/places.module';
import { RoutesModule } from './modules/routes/routes.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { TransportRequestsModule } from './modules/transport-requests/transport-requests.module';
import { GroupingModule } from './modules/grouping/grouping.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { SelfServiceModule } from './modules/self-service/self-service.module';
import { HealthModule } from './modules/health/health.module';
import { DailyLockModule } from './modules/daily-lock/daily-lock.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { RoutingModule } from './modules/routing/routing.module';
import { LocationModule } from './modules/location/location.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getTypeOrmConfig,
    }),
    RoutingModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    EmployeesModule,
    PlacesModule,
    RoutesModule,
    VehiclesModule,
    DriversModule,
    TransportRequestsModule,
    GroupingModule,
    ApprovalsModule,
    ReportsModule,
    NotificationsModule,
    AuditModule,
    DashboardModule,
    AnalyticsModule,
    SettingsModule,
    ArchiveModule,
    SelfServiceModule,
    HealthModule,
    DailyLockModule,
    ChannelsModule,
    LocationModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
