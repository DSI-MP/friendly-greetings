import { Controller, Post, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransportRequest, ApprovalHistory } from '../transport-requests/transport-request.entity';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole, RequestStatus } from '../../common/enums';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(
    @InjectRepository(TransportRequest) private reqRepo: Repository<TransportRequest>,
    @InjectRepository(ApprovalHistory) private approvalRepo: Repository<ApprovalHistory>,
  ) {}

  @Post('hr/:requestId/approve')
  @Roles(AppRole.HR, AppRole.SUPER_ADMIN)
  async hrApprove(@Param('requestId', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new Error('Request not found');
    if (req.status !== RequestStatus.TA_COMPLETED) throw new Error('Request must be TA completed');

    await this.reqRepo.update(id, { status: RequestStatus.HR_APPROVED, hr_approved_by: userId, hr_approved_at: new Date() });
    await this.approvalRepo.save({ request_id: id, action: 'HR_APPROVE', performed_by_user_id: userId });
    return { message: 'HR approved', requestId: id };
  }

  @Post('hr/:requestId/reject')
  @Roles(AppRole.HR, AppRole.SUPER_ADMIN)
  async hrReject(
    @Param('requestId', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Body('reason') reason?: string,
  ) {
    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new Error('Request not found');

    await this.reqRepo.update(id, { status: RequestStatus.HR_REJECTED, rejection_reason: reason });
    await this.approvalRepo.save({ request_id: id, action: 'HR_REJECT', performed_by_user_id: userId, reason });
    return { message: 'HR rejected', requestId: id };
  }
}
