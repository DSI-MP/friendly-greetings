import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('trip_cost_snapshots')
export class TripCostSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  request_id: number;

  @Column({ type: 'int', nullable: true })
  group_id?: number;

  @Column({ type: 'int', nullable: true })
  vehicle_id?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  estimated_cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actual_cost?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  distance_km?: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('utilization_snapshots')
export class UtilizationSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  snapshot_date: Date;

  @Column({ type: 'int', default: 0 })
  total_vehicles_used: number;

  @Column({ type: 'int', default: 0 })
  total_employees_transported: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  avg_occupancy_pct: number;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('dashboard_snapshots')
export class DashboardSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  snapshot_type: string;

  @Column({ type: 'date' })
  snapshot_date: Date;

  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
