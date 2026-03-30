import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum LocationChangeStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('location_change_requests')
export class LocationChangeRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'int', nullable: true })
  employee_id?: number;

  @Column({ type: 'int', nullable: true })
  place_id?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  place_title?: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'enum', enum: LocationChangeStatus, default: LocationChangeStatus.PENDING })
  status: LocationChangeStatus;

  @Column({ type: 'int', nullable: true })
  reviewed_by?: number;

  @Column({ type: 'text', nullable: true })
  review_note?: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at?: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
