export interface EmpTransport {
  request_date: string;
  route_name?: string | null;
  group_code?: string | null;
  registration_no?: string | null;
  vehicle_type?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  drop_note?: string | null;
  /** @deprecated use drop_note */
  pickup_note?: string | null;
  status?: string | null;
}

export interface EmpOverview {
  employee: {
    id: number;
    full_name: string;
    email: string;
    phone?: string;
    emp_no?: string;
    department_name?: string;
  };
  today_transport?: EmpTransport | null;
  recent_trips: EmpTransport[];
  pending_issues: EmpIssue[];
  pending_location_requests: EmpLocationRequest[];
}

export interface EmpIssue {
  id: number;
  subject: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  created_at: string;
  resolved_at?: string;
}

export interface EmpLocationRequest {
  id: number;
  lat: number;
  lng: number;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}
