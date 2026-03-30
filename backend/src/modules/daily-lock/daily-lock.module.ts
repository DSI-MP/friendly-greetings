import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyLock } from './daily-lock.entity';
import { DailyRun } from './daily-run.entity';
import { DailyLockController } from './daily-lock.controller';
import { DailyLockService } from './daily-lock.service';
import { TransportRequest, TransportRequestEmployee } from '../transport-requests/transport-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DailyLock, DailyRun, TransportRequest, TransportRequestEmployee])],
  controllers: [DailyLockController],
  providers: [DailyLockService],
  exports: [DailyLockService],
})
export class DailyLockModule {}
