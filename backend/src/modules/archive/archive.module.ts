import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveController } from './archive.controller';
import { DailyCloseBatch, MonthlyCloseBatch, ArchiveExport } from '../settings/settings.entity';
import { TransportRequest } from '../transport-requests/transport-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DailyCloseBatch, MonthlyCloseBatch, ArchiveExport, TransportRequest])],
  controllers: [ArchiveController],
})
export class ArchiveModule {}
