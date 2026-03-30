import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { NotificationChannel } from '../../common/enums';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  user_id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  event_type?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  entity_type?: string;

  @Column({ type: 'int', nullable: true })
  entity_id?: number;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @Column({ type: 'timestamp', nullable: true })
  read_at?: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('notification_templates')
export class NotificationTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  event_key: string;

  @Column({ type: 'varchar', length: 255 })
  title_template: string;

  @Column({ type: 'text' })
  body_template: string;

  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.IN_APP })
  channel: NotificationChannel;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('notification_delivery_logs')
export class NotificationDeliveryLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  notification_id: number;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'boolean', default: false })
  delivered: boolean;

  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @Column({ type: 'jsonb', nullable: true })
  provider_response?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
