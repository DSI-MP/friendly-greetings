import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { VehicleType } from '../../common/enums';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  @Index()
  registration_no: string;

  @Column({ type: 'enum', enum: VehicleType })
  type: VehicleType;

  @Column({ type: 'int' })
  capacity: number;

  @Column({ type: 'int', default: 0 })
  soft_overflow: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  make?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  // Permanent driver info embedded in vehicle
  @Column({ type: 'varchar', length: 150, nullable: true })
  driver_name?: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  driver_phone?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  driver_license_no?: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}

@Entity('vehicle_types')
export class VehicleTypeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;

  @Column({ type: 'int' })
  default_capacity: number;

  @Column({ type: 'int', default: 0 })
  default_soft_overflow: number;
}

@Entity('vehicle_cost_profiles')
export class VehicleCostProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  vehicle_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  cost_per_km: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  base_cost: number;

  @Column({ type: 'date' })
  effective_from: Date;

  @Column({ type: 'date', nullable: true })
  effective_to?: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
