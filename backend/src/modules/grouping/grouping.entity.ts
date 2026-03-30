import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { GroupStatus } from '../../common/enums';

@Entity('route_group_runs')
export class RouteGroupRun {
  @PrimaryGeneratedColumn()
  id: number;

  /** V3: True daily run reference — primary identity for grouped batches */
  @Column({ type: 'int', nullable: true })
  @Index()
  daily_run_id?: number;

  /** Legacy request_id kept for backward compat; NOT the primary identity */
  @Column({ type: 'int', nullable: true })
  @Index()
  request_id?: number;

  @Column({ type: 'int', default: 1 })
  run_number: number;

  @Column({ type: 'int', nullable: true })
  initiated_by_user_id?: number;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ type: 'int', default: 0 })
  total_groups: number;

  @Column({ type: 'int', default: 0 })
  total_employees: number;

  @Column({ type: 'int', default: 0 })
  unresolved_count: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  routing_source?: string;

  @Column({ type: 'text', nullable: true })
  routing_warning?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('generated_route_groups')
export class GeneratedRouteGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  run_id: number;

  /** V3: True daily run reference */
  @Column({ type: 'int', nullable: true })
  @Index()
  daily_run_id?: number;

  /** Legacy request_id kept for backward compat */
  @Column({ type: 'int', nullable: true })
  request_id?: number;

  @Column({ type: 'int', nullable: true })
  route_id?: number;

  @Column({ type: 'varchar', length: 50 })
  group_code: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  corridor_code?: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  center_lat?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  center_lng?: number;

  @Column({ type: 'int', default: 0 })
  employee_count: number;

  @Column({ type: 'enum', enum: GroupStatus, default: GroupStatus.PENDING })
  status: GroupStatus;

  @Column({ type: 'int', nullable: true })
  recommended_vehicle_id?: number;

  @Column({ type: 'int', nullable: true })
  assigned_vehicle_id?: number;

  @Column({ type: 'int', nullable: true })
  assigned_driver_id?: number;

  @Column({ type: 'boolean', default: false })
  overflow_allowed: boolean;

  @Column({ type: 'int', default: 0 })
  overflow_count: number;

  @Column({ type: 'text', nullable: true })
  cluster_note?: string;

  @Column({ type: 'text', nullable: true })
  recommendation_reason?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimated_distance_km?: number;

  @Column({ type: 'int', nullable: true })
  estimated_duration_seconds?: number;

  @Column({ type: 'jsonb', nullable: true })
  route_geometry?: number[][];

  @Column({ type: 'varchar', length: 30, nullable: true })
  routing_source?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  corridor_label?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('generated_route_group_members')
export class GeneratedRouteGroupMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  generated_group_id: number;

  @Column({ type: 'int' })
  employee_id: number;

  @Column({ type: 'int', nullable: true })
  place_id?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat_snapshot: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng_snapshot: number;

  @Column({ type: 'int', default: 0 })
  pickup_sequence: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  depot_distance_km?: number;

  @Column({ type: 'int', nullable: true })
  depot_duration_seconds?: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('assignment_exceptions')
export class AssignmentException {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  run_id: number;

  @Column({ type: 'int', nullable: true })
  group_id?: number;

  @Column({ type: 'int', nullable: true })
  employee_id?: number;

  @Column({ type: 'varchar', length: 50 })
  exception_type: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'boolean', default: false })
  resolved: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('group_vehicle_assignments')
export class GroupVehicleAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  group_id: number;

  @Column({ type: 'int' })
  vehicle_id: number;

  @Column({ type: 'int', nullable: true })
  driver_id?: number;

  @Column({ type: 'int', nullable: true })
  assigned_by_user_id?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('trip_manifests')
export class TripManifest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  group_id: number;

  @Column({ type: 'int' })
  vehicle_id: number;

  @Column({ type: 'int', nullable: true })
  driver_id?: number;

  @Column({ type: 'date' })
  trip_date: Date;

  @Column({ type: 'jsonb', nullable: true })
  employee_list?: any[];

  @Column({ type: 'jsonb', nullable: true })
  pickup_sequence?: any[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

@Entity('boarding_events')
export class BoardingEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  manifest_id: number;

  @Column({ type: 'int' })
  employee_id: number;

  @Column({ type: 'timestamp', nullable: true })
  boarded_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  alighted_at?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}

@Entity('trip_incidents')
export class TripIncident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  manifest_id: number;

  @Column({ type: 'varchar', length: 50 })
  incident_type: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int', nullable: true })
  reported_by_user_id?: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
