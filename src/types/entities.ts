// Shared entity types matching backend entities

export interface Employee {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  emp_no?: string;
  department_id: number;
  user_id?: number;
  place_id?: number;
  lat?: number;
  lng?: number;
  status: AccountStatus;
  register_as?: 'EMP' | 'HOD';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: number;
  registration_no: string;
  type: 'VAN' | 'BUS';
  capacity: number;
  soft_overflow: number;
  make?: string;
  model?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_license_no?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: number;
  full_name: string;
  phone: string;
  license_no?: string;
  default_vehicle_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  name: string;
  code?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Place {
  id: number;
  external_place_id?: string;
  title: string;
  address?: string;
  latitude: number;
  longitude: number;
  gn_division_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RouteItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  bearing_from_depot?: number;
  corridor_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RouteCorridor {
  id: number;
  name: string;
  bearing_start?: number;
  bearing_end?: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  status: AccountStatus;
  department_id?: number;
  employee_id?: number;
  f2a_enabled: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  category?: string;
  description?: string;
  updated_at?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  body: string;
  event_type?: string;
  entity_type?: string;
  entity_id?: number;
  read: boolean;
  read_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  performed_by_user_id?: number;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface RouteGroupRun {
  id: number;
  request_id: number;
  run_number: number;
  initiated_by_user_id?: number;
  parameters?: Record<string, any>;
  summary?: string;
  total_groups: number;
  total_employees: number;
  unresolved_count: number;
  created_at: string;
}

export interface GeneratedRouteGroup {
  id: number;
  run_id: number;
  request_id: number;
  route_id?: number;
  group_code: string;
  center_lat?: number;
  center_lng?: number;
  employee_count: number;
  status: 'PENDING' | 'CONFIRMED' | 'ADJUSTED' | 'DISPATCHED';
  recommended_vehicle_id?: number;
  assigned_vehicle_id?: number;
  assigned_driver_id?: number;
  overflow_allowed: boolean;
  overflow_count: number;
  cluster_note?: string;
  recommendation_reason?: string;
  created_at: string;
}

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL' | 'INACTIVE';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
