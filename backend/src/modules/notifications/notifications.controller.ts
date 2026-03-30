import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  getNotifications(@CurrentUser('id') userId: number) {
    return this.service.getUserNotifications(userId);
  }

  @Post('mark-read')
  markRead(@Body('ids') ids: number[]) {
    return this.service.markAsRead(ids);
  }
}
