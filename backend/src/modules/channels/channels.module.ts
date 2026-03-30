import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { NotificationDeliveryLog } from '../notifications/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationDeliveryLog])],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
