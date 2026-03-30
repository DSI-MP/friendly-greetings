import type { TransportRequest, RequestStatus } from '@/types/transport';

/* ─── Employee in workflow context ─── */

export interface WorkflowEmployee {
  id: number;
  emp_no: string;
  full_name: string;
  department: string;
  phone?: string;
  destination_location?: string;
  lat?: number;
  lng?: number;
  location_resolved: boolean;
  place_id?: number;
  place_title?: string;
  department_name?: string;
  selected?: boolean;
}

/* ─── Group assignment ─── */

export interface GroupAssignment {
  id: number;
  group_code: string;
  employee_count: number;
  status: 'PENDING' | 'CONFIRMED' | 'ADJUSTED';
  assigned_vehicle_id?: number;
  assigned_vehicle_reg?: string;
  overflow_count: number;
  cluster_note?: string;
  recommendation_reason?: string;
  corridor_code?: string;
  corridor_label?: string;
  estimated_distance_km?: number;
  estimated_duration_seconds?: number;
  routing_source?: string;
  route_geometry?: number[][];
  center_lat?: number;
  center_lng?: number;
  driver_name?: string;
  driver_phone?: string;
  has_permanent_driver?: boolean;
  members?: GroupingRunMember[];
}

/* ─── Status history entry ─── */

export interface StatusHistoryEntry {
  id?: number;
  status?: RequestStatus;
  from_status?: RequestStatus;
  to_status?: RequestStatus;
  changed_by?: string;
  changed_at?: string;
  reason?: string;
  note?: string;
  created_at?: string;
}

/* ─── Full request detail ─── */

export interface RequestDetail extends TransportRequest {
  department_name?: string;
  created_by_name?: string;
  employee_count?: number;
  employees?: WorkflowEmployee[];
  groups?: GroupAssignment[];
  status_history?: StatusHistoryEntry[];
}

/* ─── Grouping run member ─── */

export interface GroupingRunMember {
  employee_id: number;
  full_name?: string;
  emp_no?: string;
  lat_snapshot: number;
  lng_snapshot: number;
  stop_sequence: number;
  depot_distance_km?: number;
  depot_duration_seconds?: number;
}

/* ─── Grouping run group ─── */

export interface GroupingRunGroup {
  id: number;
  group_code: string;
  corridor_code?: string;
  corridor_label?: string;
  center_lat?: number;
  center_lng?: number;
  employee_count: number;
  status: string;
  assigned_vehicle_id?: number;
  assigned_vehicle_reg?: string;
  driver_name?: string;
  driver_phone?: string;
  has_permanent_driver?: boolean;
  overflow_allowed?: boolean;
  overflow_count?: number;
  recommendation_reason?: string;
  cluster_note?: string;
  route_geometry?: number[][];
  estimated_distance_km?: number;
  estimated_duration_seconds?: number;
  routing_source?: string;
  members?: GroupingRunMember[];
}

/* ─── Grouping run ─── */

export interface GroupingRun {
  id: number;
  run_number: number;
  total_groups: number;
  total_employees: number;
  unresolved_count: number;
  summary?: string;
  routing_source?: string;
  routing_warning?: string;
  created_at?: string;
  groups?: GroupingRunGroup[];
  // V3 daily run fields
  daily_run_id?: number;
  daily_run_status?: string;
  request_count?: number;
  department_count?: number;
  parameters?: any;
}
