import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { AuditAction } from '../../common/enums';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  entity_type: string;

  @Column({ type: 'int', nullable: true })
  entity_id?: number;

  @Column({ type: 'int', nullable: true })
  performed_by_user_id?: number;

  @Column({ type: 'jsonb', nullable: true })
  old_values?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  new_values?: Record<string, any>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip_address?: string;

  @Column({ type: 'text', nullable: true })
  user_agent?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('auth_events')
export class AuthEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  user_id?: number;

  @Column({ type: 'varchar', length: 50 })
  event_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip_address?: string;

  @Column({ type: 'text', nullable: true })
  user_agent?: string;

  @Column({ type: 'boolean', default: false })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  failure_reason?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('password_reset_requests')
export class PasswordResetRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 10 })
  otp: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('two_factor_settings')
export class TwoFactorSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  user_id: number;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'text', nullable: true })
  secret?: string;

  @Column({ type: 'jsonb', nullable: true })
  recovery_codes?: string[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at?: Date;
}
