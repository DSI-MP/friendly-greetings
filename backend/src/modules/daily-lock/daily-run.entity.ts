import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum DailyRunStatus {
  OPEN = 'OPEN',
  LOCKED = 'LOCKED',
  GROUPED = 'GROUPED',
  ASSIGNING = 'ASSIGNING',
  READY = 'READY',
  SUBMITTED_TO_HR = 'SUBMITTED_TO_HR',
  HR_APPROVED = 'HR_APPROVED',
  DISPATCHED = 'DISPATCHED',
  CLOSED = 'CLOSED',
}

@Entity('daily_runs')
export class DailyRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', unique: true })
  @Index()
  run_date: Date;

  @Column({ type: 'enum', enum: DailyRunStatus, default: DailyRunStatus.OPEN })
  status: DailyRunStatus;

  @Column({ type: 'jsonb', nullable: true })
  included_request_ids?: number[];

  @Column({ type: 'int', default: 0 })
  request_count: number;

  @Column({ type: 'int', default: 0 })
  department_count: number;

  @Column({ type: 'int', default: 0 })
  total_employees: number;

  @Column({ type: 'int', default: 0 })
  unresolved_count: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  routing_source?: string;

  @Column({ type: 'text', nullable: true })
  routing_warning?: string;

  @Column({ type: 'text', nullable: true })
  grouping_summary?: string;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: Record<string, any>;

  @Column({ type: 'int', nullable: true })
  created_by?: number;

  @Column({ type: 'int', nullable: true })
  locked_by?: number;

  @Column({ type: 'timestamp', nullable: true })
  locked_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  grouped_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  submitted_to_hr_at?: Date;

  @Column({ type: 'int', default: 0 })
  total_groups: number;

  @Column({ type: 'int', nullable: true })
  latest_run_id?: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
