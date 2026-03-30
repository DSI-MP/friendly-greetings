import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { TripCostSnapshot, UtilizationSnapshot, DashboardSnapshot } from './analytics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TripCostSnapshot, UtilizationSnapshot, DashboardSnapshot])],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
