import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification, NotificationDeliveryLog } from './notification.entity';
import { User } from '../users/user.entity';
import { AppRole } from '../../common/enums';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(NotificationDeliveryLog) private logRepo: Repository<NotificationDeliveryLog>,
    @InjectRepository(User) private userRepo: Repository<User>,
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

  /** Send notification to all users with a given role */
  async notifyRole(roles: AppRole[], title: string, body: string, eventType?: string, entityType?: string, entityId?: number) {
    try {
      const users = await this.userRepo.find({
        where: { role: In(roles), status: 'ACTIVE' as any },
        select: ['id'],
      });
      const promises = users.map(u =>
        this.createNotification({ userId: u.id, title, body, eventType, entityType, entityId }),
      );
      await Promise.all(promises);
    } catch {
      // Non-critical: don't fail the workflow if notifications fail
    }
  }

  /** Send notification to a specific user by ID */
  async notifyUser(userId: number, title: string, body: string, eventType?: string, entityType?: string, entityId?: number) {
    try {
      await this.createNotification({ userId, title, body, eventType, entityType, entityId });
    } catch {
      // Non-critical
    }
  }
}
