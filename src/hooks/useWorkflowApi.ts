import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { RequestDetail, WorkflowEmployee, GroupAssignment } from '@/types/workflow';
import type { RequestStatus } from '@/types/transport';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/translateError';

export type { RequestDetail, WorkflowEmployee, GroupAssignment } from '@/types/workflow';

/* ─── Payload types ─── */

interface CreateRequestPayload {
  departmentId?: number;
  requestDate: string;
  notes?: string;
  otTime?: string;
}

/* ─── Helper: safely extract response data ─── */

function extractData<T>(res: any): T {
  return res.data?.data ?? res.data;
}

/* ─── Hook ─── */

export function useWorkflowApi() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const wrap = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      setLoading(true);
      try {
        return await fn();
      } catch (err: any) {
        toast({ title: 'Error', description: getApiErrorMessage(err), variant: 'destructive' });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  /* ── List requests ── */

  const fetchRequests = useCallback(
    async (filters?: { status?: RequestStatus; departmentId?: number }) => {
      return wrap(async () => {
        const PAGE_LIMIT = 500;
        const params: Record<string, any> = { page: 1, limit: PAGE_LIMIT };
        if (filters?.status) params.status = filters.status;
        if (filters?.departmentId) params.departmentId = filters.departmentId;
        const res = await api.get('/transport-requests', { params });
        const data = extractData<any>(res);
        const items = data?.items || data || [];
        const total = data?.total || items.length;
        if (total > items.length) {
          const pages = Math.ceil((total - items.length) / PAGE_LIMIT);
          const promises = [];
          for (let p = 2; p <= pages + 1; p++) {
            promises.push(api.get('/transport-requests', { params: { ...params, page: p } }));
          }
          const results = await Promise.all(promises);
          for (const r of results) {
            const d = extractData<any>(r);
            items.push(...(d?.items || []));
          }
        }
        return items as RequestDetail[];
      });
    },
    [wrap],
  );

  /* ── Single request ── */

  const fetchRequestById = useCallback(
    async (id: number) => {
      return wrap(async () => {
        const res = await api.get(`/transport-requests/${id}`);
        return extractData<RequestDetail>(res);
      });
    },
    [wrap],
  );

  /* ── Create ── */

  const createRequest = useCallback(
    async (data: CreateRequestPayload) => {
      return wrap(async () => {
        const payload: Record<string, any> = { requestDate: data.requestDate };
        if (data.notes) payload.notes = data.notes;
        if (data.otTime) payload.otTime = data.otTime;
        if (data.departmentId != null) payload.departmentId = data.departmentId;

        const res = await api.post('/transport-requests', payload);
        return extractData<RequestDetail>(res);
      });
    },
    [wrap],
  );

  /* ── Update (allowed until daily lock) ── */

  const updateRequest = useCallback(
    async (id: number, data: { notes?: string; requestDate?: string; otTime?: string }) => {
      return wrap(async () => {
        const res = await api.patch(`/transport-requests/${id}`, data);
        return extractData<RequestDetail>(res);
      });
    },
    [wrap],
  );

  /* ── Employees ── */

  const addEmployees = useCallback(
    async (requestId: number, employeeIds: number[]) => {
      return wrap(async () => {
        await api.post(`/transport-requests/${requestId}/add-employees`, { employeeIds });
        return true;
      });
    },
    [wrap],
  );

  const removeEmployees = useCallback(
    async (requestId: number, employeeIds: number[]) => {
      return wrap(async () => {
        await api.post(`/transport-requests/${requestId}/remove-employees`, { employeeIds });
        return true;
      });
    },
    [wrap],
  );

  /* ── Status transitions ── */

  const submitRequest = useCallback(
    async (id: number) => {
      return wrap(async () => {
        await api.post(`/transport-requests/${id}/submit`);
        toast({ title: 'Submitted', description: 'Request submitted for admin review.' });
        return true;
      });
    },
    [wrap, toast],
  );

  const adminApprove = useCallback(
    async (id: number) => {
      return wrap(async () => {
        await api.post(`/transport-requests/${id}/admin-approve`);
        toast({ title: 'Approved', description: 'Request approved.' });
        return true;
      });
    },
    [wrap, toast],
  );

  const adminReject = useCallback(
    async (id: number, reason: string) => {
      return wrap(async () => {
        await api.post(`/transport-requests/${id}/admin-reject`, { reason });
        toast({ title: 'Rejected', description: 'Request rejected.' });
        return true;
      });
    },
    [wrap, toast],
  );

  const cancelRequest = useCallback(
    async (id: number, reason?: string) => {
      return wrap(async () => {
        await api.post(`/transport-requests/${id}/cancel`, { reason });
        toast({ title: 'Cancelled', description: 'Request cancelled.' });
        return true;
      });
    },
    [wrap, toast],
  );

  /* ── Daily Grouping ── */

  const runDailyGrouping = useCallback(
    async (date: string) => {
      return wrap(async () => {
        const res = await api.post(`/grouping/run/daily/${date}`, {}, { timeout: 300000 });
        toast({ title: 'Grouping Complete', description: 'Daily combined grouping executed.' });
        return extractData<any>(res);
      });
    },
    [wrap, toast],
  );

  const fetchDailyGroupingRun = useCallback(
    async (date: string) => {
      return wrap(async () => {
        const res = await api.get(`/grouping/run/daily/${date}/latest`);
        return extractData<any>(res);
      });
    },
    [wrap],
  );

  /* Legacy grouping methods removed — use daily grouping only */

  const assignVehicle = useCallback(
    async (groupId: number, vehicleId: number) => {
      return wrap(async () => {
        const res = await api.patch(`/grouping/groups/${groupId}/assign-vehicle`, { vehicleId });
        return extractData<any>(res);
      });
    },
    [wrap],
  );

  const unassignVehicle = useCallback(
    async (groupId: number) => {
      return wrap(async () => {
        const res = await api.patch(`/grouping/groups/${groupId}/unassign-vehicle`, {});
        toast({ title: 'Unassigned', description: 'Vehicle unassigned from group.' });
        return extractData<any>(res);
      });
    },
    [wrap, toast],
  );

  const splitAssignGroup = useCallback(
    async (groupId: number, vehicleIds: number[]) => {
      return wrap(async () => {
        const res = await api.post(`/grouping/groups/${groupId}/split-assign`, { vehicleIds });
        toast({ title: 'Group Split', description: 'Group split across multiple vehicles successfully.' });
        return extractData<any>(res);
      });
    },
    [wrap, toast],
  );

  const undoSplit = useCallback(
    async (subGroupId: number) => {
      return wrap(async () => {
        const res = await api.post(`/grouping/groups/${subGroupId}/undo-split`, {});
        toast({ title: 'Split Undone', description: 'Sub-groups merged back into one group.' });
        return extractData<any>(res);
      });
    },
    [wrap, toast],
  );

  const splitGroup = useCallback(
    async (groupId: number) => {
      return wrap(async () => {
        const res = await api.post(`/grouping/groups/${groupId}/split`, {});
        toast({ title: 'Group Split', description: 'Group split into two sub-groups. Assign vehicles individually.' });
        return extractData<any>(res);
      });
    },
    [wrap, toast],
  );

  // assignDriver removed: driver is auto-resolved from vehicle's permanent driver

  /* ── TA / HR ── */

  const submitToHr = useCallback(
    async (requestId: number) => {
      return wrap(async () => {
        await api.post(`/transport-requests/${requestId}/ta-completed`);
        toast({ title: 'Submitted to HR', description: 'Assignment plan sent for HR approval.' });
        return true;
      });
    },
    [wrap, toast],
  );

  const submitDailyToHr = useCallback(
    async (date: string) => {
      return wrap(async () => {
        const res = await api.post('/daily-lock/submit-to-hr', { date });
        toast({ title: 'Submitted to HR', description: `Daily batch for ${date} sent for HR approval.` });
        return extractData<any>(res);
      });
    },
    [wrap, toast],
  );

  const hrApprove = useCallback(
    async (requestId: number) => {
      return wrap(async () => {
        await api.post(`/transport-requests/${requestId}/hr-approve`);
        toast({ title: 'HR Approved', description: 'Final approval granted.' });
        return true;
      });
    },
    [wrap, toast],
  );

  const hrReject = useCallback(
    async (requestId: number, reason: string) => {
      return wrap(async () => {
        await api.post(`/transport-requests/${requestId}/hr-reject`, { reason });
        toast({ title: 'HR Rejected', description: 'Plan rejected by HR.' });
        return true;
      });
    },
    [wrap, toast],
  );

  /* ── Employees ── */

  const fetchDeptEmployees = useCallback(
    async (deptId?: number) => {
      return wrap(async () => {
        const PAGE_LIMIT = 500;
        const params: Record<string, any> = { page: 1, limit: PAGE_LIMIT };
        if (deptId) params.departmentId = deptId;
        const res = await api.get('/employees', { params });
        const data = extractData<any>(res);
        const items = data?.items || [];
        const total = data?.total || items.length;

        if (total > items.length) {
          const pages = Math.ceil((total - items.length) / PAGE_LIMIT);
          const promises = [];
          for (let p = 2; p <= pages + 1; p++) {
            promises.push(api.get('/employees', { params: { ...params, page: p } }));
          }
          const results = await Promise.all(promises);
          for (const r of results) {
            const d = extractData<any>(r);
            items.push(...(d?.items || []));
          }
        }

        return items as WorkflowEmployee[];
      });
    },
    [wrap],
  );

  /* ── Places ── */

  const fetchPlaces = useCallback(
    async () => {
      return wrap(async () => {
      const res = await api.get('/places', { params: { limit: 500 } });
        const data = extractData<any>(res);
        return ((data?.items || []) as any[]).map(p => ({
          id: p.id,
          title: p.title,
          address: p.address,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
        })) as { id: number; title: string; address?: string; latitude: number; longitude: number }[];
      });
    },
    [wrap],
  );

  const updateEmployeeLocation = useCallback(
    async (employeeId: number, placeId: number, lat: number, lng: number) => {
      return wrap(async () => {
        await api.patch(`/employees/${employeeId}`, { place_id: placeId, lat: Number(lat), lng: Number(lng) });
        return true;
      });
    },
    [wrap],
  );

  /* ── Vehicles / Drivers ── */

  const fetchVehicles = useCallback(
    async () => {
      return wrap(async () => {
        const res = await api.get('/vehicles', { params: { limit: 100 } });
        const data = extractData<any>(res);
        return data?.items || [];
      });
    },
    [wrap],
  );

  const fetchDrivers = useCallback(
    async () => {
      return wrap(async () => {
        const res = await api.get('/drivers', { params: { limit: 100 } });
        const data = extractData<any>(res);
        return data?.items || [];
      });
    },
    [wrap],
  );

  /* ── Locked dates ── */

  const fetchLockedDates = useCallback(
    async () => {
      return wrap(async () => {
        const res = await api.get('/daily-lock/locked-dates');
        return extractData<any[]>(res) || [];
      });
    },
    [wrap],
  );

  const fetchDailyLockStatus = useCallback(
    async (date: string) => {
      return wrap(async () => {
        const res = await api.get('/daily-lock/status', { params: { date } });
        return extractData<any>(res);
      });
    },
    [wrap],
  );

  const lockDailyRun = useCallback(
    async (date: string) => {
      return wrap(async () => {
        const res = await api.post('/daily-lock/lock', { date });
        toast({ title: 'Daily Run Locked', description: `All approved requests for ${date} are now locked.` });
        return extractData<any>(res);
      });
    },
    [wrap, toast],
  );

  const unlockDailyRun = useCallback(
    async (date: string) => {
      return wrap(async () => {
        const res = await api.post('/daily-lock/unlock', { date });
        toast({ title: 'Daily Run Unlocked', description: `The daily run for ${date} is now editable again.` });
        return extractData<any>(res);
      });
    },
    [wrap, toast],
  );

  return {
    loading,
    // Requests
    fetchRequests,
    fetchRequestById,
    createRequest,
    updateRequest,
    // Employees on request
    addEmployees,
    removeEmployees,
    // Workflow
    submitRequest,
    adminApprove,
    adminReject,
    cancelRequest,
    // Daily Grouping
    runDailyGrouping,
    fetchDailyGroupingRun,
    assignVehicle,
    unassignVehicle,
    splitAssignGroup,
    splitGroup,
    undoSplit,
    // TA / HR
    submitToHr,
    submitDailyToHr,
    hrApprove,
    hrReject,
    // Data
    fetchDeptEmployees,
    fetchPlaces,
    updateEmployeeLocation,
    fetchVehicles,
    fetchDrivers,
    // Daily Lock
    fetchLockedDates,
    fetchDailyLockStatus,
    lockDailyRun,
    unlockDailyRun,
  };
}
