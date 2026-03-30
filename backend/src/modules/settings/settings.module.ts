import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import {
  SystemSetting, HolidayCalendar, GroupingTemplate, SpecialRunPlan,
  ImportLog, DailyCloseBatch, MonthlyCloseBatch, ArchiveExport,
} from './settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    SystemSetting, HolidayCalendar, GroupingTemplate, SpecialRunPlan,
    ImportLog, DailyCloseBatch, MonthlyCloseBatch, ArchiveExport,
  ])],
  controllers: [SettingsController],
  exports: [TypeOrmModule],
})
export class SettingsModule {}
