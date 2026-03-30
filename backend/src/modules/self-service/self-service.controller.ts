import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';
import { SelfServiceService } from './self-service.service';
import { LocationChangeRequestDto, SubmitIssueDto, ReviewNoteDto } from './dto/self-service.dto';

@ApiTags('Self Service')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('self-service')
export class SelfServiceController {
  constructor(private readonly service: SelfServiceService) {}

  @Post('location-change')
  requestLocationChange(
    @CurrentUser('id') userId: number,
    @Body() data: LocationChangeRequestDto,
  ) {
    return this.service.requestLocationChange(userId, data);
  }

  @Get('location-changes')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  findAllLocationChanges(@Query('status') status?: string) {
    return this.service.findAllRequests(status);
  }

  @Patch('location-changes/:id/approve')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  approveLocationChange(
    @Param('id') id: number,
    @CurrentUser('id') reviewerId: number,
    @Body() body: ReviewNoteDto,
  ) {
    return this.service.approveRequest(id, reviewerId, body.note);
  }

  @Patch('location-changes/:id/reject')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  rejectLocationChange(
    @Param('id') id: number,
    @CurrentUser('id') reviewerId: number,
    @Body() body: ReviewNoteDto,
  ) {
    return this.service.rejectRequest(id, reviewerId, body.note);
  }

  @Post('issues')
  submitIssue(@CurrentUser('id') userId: number, @Body() data: SubmitIssueDto) {
    return { message: 'Issue submitted', userId, ...data, createdAt: new Date() };
  }
}
