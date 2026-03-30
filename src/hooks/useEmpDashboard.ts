import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/translateError';
import type { EmpOverview } from '@/types/emp';

export function useEmpDashboard() {
  const [data, setData] = useState<EmpOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/self-service/overview');
      setData(res.data?.data ?? res.data);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'apiErrors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
