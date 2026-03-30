import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsController } from './approvals.controller';
import { TransportRequest, ApprovalHistory } from '../transport-requests/transport-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TransportRequest, ApprovalHistory])],
  controllers: [ApprovalsController],
})
export class ApprovalsModule {}
