import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { Role } from '@/types/auth';
import { getApiErrorMessage } from '@/lib/translateError';

export interface AdminDashboard {
  totalRequests: number;
  pendingRequests: number;
  totalEmployees: number;
  totalVehicles: number;
  totalDrivers: number;
  totalDepartments: number;
}

export interface HodDashboard {
  deptRequests: number;
  deptEmployees: number;
  departmentId: number;
}

export interface HrDashboard {
  pendingHR: number;
  approved: number;
}

export interface TaDashboard {
  pendingGrouping: number;
  processing: number;
}

export interface PlanningDashboard {
  totalVehicles: number;
  totalDrivers: number;
}

type DashboardData = AdminDashboard | HodDashboard | HrDashboard | TaDashboard | PlanningDashboard | null;

function getEndpoint(role: Role): string | null {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/dashboard/admin';
    case 'HOD':
      return '/dashboard/hod';
    case 'HR':
      return '/dashboard/hr';
    case 'TRANSPORT_AUTHORITY':
      return '/dashboard/ta';
    case 'PLANNING':
      return '/dashboard/planning';
    default:
      return null;
  }
}

export function useDashboardData(role: Role) {
  const [data, setData] = useState<DashboardData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const endpoint = getEndpoint(role);
    if (!endpoint) {
      setLoading(false);
      return;
    }

    api.get(endpoint)
      .then((res) => setData(res.data?.data ?? res.data))
      .catch((err) => setError(getApiErrorMessage(err, 'apiErrors.failedToLoad')))
      .finally(() => setLoading(false));
  }, [role]);

  return { data, loading, error };
}
