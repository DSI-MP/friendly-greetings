import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { RequestStatus } from '../../common/enums';
import { Department } from '../departments/department.entity';
import { User } from '../users/user.entity';

/* ─────────────────────────────── Transport Request ─────────────────────────────── */

@Entity('transport_requests')
export class TransportRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  department_id: number;

  @ManyToOne(() => Department, { eager: true })
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: User;

  @Column({ type: 'date' })
  @Index()
  request_date: Date;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.DRAFT })
  @Index()
  status: RequestStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  ot_time?: string;

  /* ── Approval tracking ── */

  @Column({ type: 'int', nullable: true })
  admin_approved_by?: number;

  @Column({ type: 'timestamp', nullable: true })
  admin_approved_at?: Date;

  @Column({ type: 'int', nullable: true })
  hr_approved_by?: number;

  @Column({ type: 'timestamp', nullable: true })
  hr_approved_at?: Date;

  @Column({ type: 'int', nullable: true })
  daily_locked_by?: number;

  @Column({ type: 'timestamp', nullable: true })
  daily_locked_at?: Date;

  @Column({ type: 'text', nullable: true })
  rejection_reason?: string;

  /* ── Timestamps ── */

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}

/* ─────────────────────────────── Request ↔ Employee link ─────────────────────────────── */

@Entity('transport_request_employees')
export class TransportRequestEmployee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  request_id: number;

  @Column({ type: 'int' })
  employee_id: number;

  @Column({ type: 'text', nullable: true })
  pickup_notes?: string;

  @Column({ type: 'text', nullable: true })
  drop_notes?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

/* ─────────────────────────────── Status history ─────────────────────────────── */

@Entity('request_status_history')
export class RequestStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  request_id: number;

  @Column({ type: 'enum', enum: RequestStatus })
  from_status: RequestStatus;

  @Column({ type: 'enum', enum: RequestStatus })
  to_status: RequestStatus;

  @Column({ type: 'int', nullable: true })
  changed_by_user_id?: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

/* ─────────────────────────────── Approval history ─────────────────────────────── */

@Entity('approval_history')
export class ApprovalHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  request_id: number;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'int' })
  performed_by_user_id: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
