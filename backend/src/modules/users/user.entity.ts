import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { AppRole, AccountStatus } from '../../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  full_name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string;

  @Column({ type: 'text' })
  password_hash: string;

  @Column({ type: 'enum', enum: AppRole, default: AppRole.EMP })
  role: AppRole;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status: AccountStatus;

  @Column({ type: 'int', nullable: true })
  department_id?: number;

  @Column({ type: 'int', nullable: true })
  employee_id?: number;

  @Column({ type: 'boolean', default: false })
  f2a_enabled: boolean;

  @Column({ type: 'text', nullable: true })
  f2a_secret?: string | null;

  @Column({ name: 'refresh_token_hash', type: 'text', nullable: true })
  refresh_token_hash?: string;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at?: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
