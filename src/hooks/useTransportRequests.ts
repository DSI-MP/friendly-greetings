import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import type { TransportRequest, PaginatedResponse, RequestStatus } from '@/types/transport';
import { getApiErrorMessage } from '@/lib/translateError';

interface Filters {
  page: number;
  limit: number;
  status?: RequestStatus;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export function useTransportRequests() {
  const [data, setData] = useState<PaginatedResponse<TransportRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    page: 1,
    limit: 15,
    sortOrder: 'DESC',
    sortBy: 'request_date',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page: filters.page,
        limit: filters.limit,
      };
      if (filters.status) params.status = filters.status;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;

      const res = await api.get<{ success: boolean; data: PaginatedResponse<TransportRequest> }>(
        '/transport-requests',
        { params },
      );
      setData(res.data.data);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'apiErrors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setPage = (page: number) => setFilters(f => ({ ...f, page }));
  const setStatus = (status?: RequestStatus) => setFilters(f => ({ ...f, status, page: 1 }));
  const refresh = () => fetchData();

  return { data, loading, error, filters, setPage, setStatus, refresh, setFilters };
}
