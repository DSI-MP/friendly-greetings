import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('daily_locks')
export class DailyLock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', unique: true })
  lock_date: Date;

  @Column({ type: 'boolean', default: true })
  is_locked: boolean;

  @Column({ type: 'int' })
  locked_by_user_id: number;

  @Column({ type: 'int', nullable: true })
  unlocked_by_user_id?: number;

  @Column({ type: 'timestamp', nullable: true })
  locked_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  unlocked_at?: Date;

  /** Number of approved requests that were locked in this batch */
  @Column({ type: 'int', default: 0 })
  locked_request_count: number;

  /** Total employee count across all locked requests */
  @Column({ type: 'int', default: 0 })
  total_employee_count: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
