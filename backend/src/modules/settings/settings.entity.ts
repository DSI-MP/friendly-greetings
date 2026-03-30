import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'timestamp', nullable: true })
  updated_at?: Date;
}

@Entity('holiday_calendar')
export class HolidayCalendar {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'boolean', default: false })
  is_recurring: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('grouping_templates')
export class GroupingTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'jsonb' })
  parameters: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('special_run_plans')
export class SpecialRunPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  plan_date: Date;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  config?: Record<string, any>;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('import_logs')
export class ImportLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  entity_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  file_name?: string;

  @Column({ type: 'int', default: 0 })
  total_records: number;

  @Column({ type: 'int', default: 0 })
  success_count: number;

  @Column({ type: 'int', default: 0 })
  error_count: number;

  @Column({ type: 'jsonb', nullable: true })
  errors?: any[];

  @Column({ type: 'int', nullable: true })
  imported_by_user_id?: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('daily_close_batches')
export class DailyCloseBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', unique: true })
  close_date: Date;

  @Column({ type: 'int', nullable: true })
  closed_by_user_id?: number;

  @Column({ type: 'int', default: 0 })
  requests_closed: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('monthly_close_batches')
export class MonthlyCloseBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 7 })
  close_month: string; // YYYY-MM

  @Column({ type: 'int', nullable: true })
  closed_by_user_id?: number;

  @Column({ type: 'int', default: 0 })
  requests_archived: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('archive_exports')
export class ArchiveExport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  export_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  file_path?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'int', nullable: true })
  exported_by_user_id?: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
