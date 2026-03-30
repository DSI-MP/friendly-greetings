import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationTemplate, NotificationDeliveryLog } from './notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, NotificationTemplate, NotificationDeliveryLog])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
