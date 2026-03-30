import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/translateError';

interface DailyLockStatus {
  date: string;
  isLocked: boolean;
  lockedAt?: string;
  lockedByUserId?: number;
  lockedRequestCount?: number;
  totalEmployeeCount?: number;
  approvedRequestCount?: number;
}

export function useDailyLock(date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const { toast } = useToast();
  const [status, setStatus] = useState<DailyLockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/daily-lock/status', { params: { date: targetDate } });
      setStatus(res.data?.data ?? res.data);
    } catch {
      setStatus({ date: targetDate, isLocked: false });
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const lock = useCallback(async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/daily-lock/lock', { date: targetDate });
      await fetchStatus();
      return res.data?.data ?? res.data;
    } catch (err: any) {
      toast({ title: 'Daily lock failed', description: getApiErrorMessage(err), variant: 'destructive' });
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [targetDate, fetchStatus, toast]);

  const unlock = useCallback(async () => {
    setActionLoading(true);
    try {
      await api.post('/daily-lock/unlock', { date: targetDate });
      await fetchStatus();
    } catch (err: any) {
      toast({ title: 'Daily unlock failed', description: getApiErrorMessage(err), variant: 'destructive' });
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [targetDate, fetchStatus, toast]);

  return {
    isLocked: status?.isLocked ?? false,
    status,
    loading,
    actionLoading,
    lock,
    unlock,
    refresh: fetchStatus,
    approvedRequestCount: status?.approvedRequestCount ?? 0,
    lockedRequestCount: status?.lockedRequestCount ?? 0,
    totalEmployeeCount: status?.totalEmployeeCount ?? 0,
  };
}
