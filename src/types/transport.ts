/* ─── Request statuses ─── */

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ADMIN_APPROVED'
  | 'ADMIN_REJECTED'
  | 'DAILY_LOCKED'
  | 'TA_PROCESSING'
  | 'GROUPING_COMPLETED'
  | 'TA_COMPLETED'
  | 'HR_APPROVED'
  | 'HR_REJECTED'
  | 'DISPATCHED'
  | 'CLOSED'
  | 'ARCHIVED'
  | 'CANCELLED';

/* ─── Transport request (list view) ─── */

export interface TransportRequest {
  id: number;
  department_id: number;
  created_by_user_id: number;
  request_date: string;
  status: RequestStatus;
  notes?: string;
  ot_time?: string;
  admin_approved_by?: number;
  admin_approved_at?: string;
  hr_approved_by?: number;
  hr_approved_at?: string;
  daily_locked_by?: number;
  daily_locked_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  // Eager-loaded relations
  department?: { id: number; name: string };
}

/* ─── Paginated response ─── */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ─── Create request payload ─── */

export interface CreateTransportRequest {
  departmentId?: number;
  requestDate: string;
  notes?: string;
  otTime?: string;
}
