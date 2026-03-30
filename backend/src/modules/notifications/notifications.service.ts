import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationDeliveryLog } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(NotificationDeliveryLog) private logRepo: Repository<NotificationDeliveryLog>,
  ) {}

  async getUserNotifications(userId: number) {
    return this.notifRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(notificationIds: number[]) {
    await this.notifRepo
      .createQueryBuilder()
      .update()
      .set({ read: true, read_at: new Date() })
      .whereInIds(notificationIds)
      .execute();
    return { message: 'Marked as read' };
  }

  async createNotification(data: {
    userId: number; title: string; body: string;
    eventType?: string; entityType?: string; entityId?: number;
  }) {
    return this.notifRepo.save(this.notifRepo.create({
      user_id: data.userId,
      title: data.title,
      body: data.body,
      event_type: data.eventType,
      entity_type: data.entityType,
      entity_id: data.entityId,
    }));
  }
}
