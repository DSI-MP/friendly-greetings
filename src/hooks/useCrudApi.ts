import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import type { PaginatedResponse } from '@/types/entities';
import { getApiErrorMessage } from '@/lib/translateError';

interface UseCrudOptions {
  endpoint: string;
  defaultSort?: string;
  defaultOrder?: 'ASC' | 'DESC';
  autoFetch?: boolean;
}

export function useCrudApi<T>({ endpoint, defaultSort = 'id', defaultOrder = 'DESC', autoFetch = true }: UseCrudOptions) {
  const [data, setData] = useState<PaginatedResponse<T> | null>(null);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [limit] = useState(15);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit, sortBy: defaultSort, sortOrder: defaultOrder };
      if (search) params.search = search;
      const res = await api.get<{ success: boolean; data: PaginatedResponse<T> }>(endpoint, { params });
      const d = res.data?.data ?? res.data;
      setData(d as any);
      setItems(Array.isArray(d) ? d : ((d as any)?.items ?? []));
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'apiErrors.failedToLoad'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, limit, search, defaultSort, defaultOrder]);

  useEffect(() => { if (autoFetch) fetchData(); }, [fetchData, autoFetch]);

  const create = async (body: Partial<T>) => {
    const res = await api.post(endpoint, body);
    await fetchData();
    return res.data;
  };

  const update = async (id: number, body: Partial<T>) => {
    const res = await api.patch(`${endpoint}/${id}`, body);
    await fetchData();
    return res.data;
  };

  const remove = async (id: number) => {
    const res = await api.delete(`${endpoint}/${id}`);
    await fetchData();
    return res.data;
  };

  const doAction = async (id: number, action: string, body?: any) => {
    const res = await api.patch(`${endpoint}/${id}/${action}`, body ?? {});
    await fetchData();
    return res.data;
  };

  const postAction = async (id: number, action: string, body?: any) => {
    const res = await api.post(`${endpoint}/${id}/${action}`, body ?? {});
    await fetchData();
    return res.data;
  };

  return {
    data, items, loading, error, page, search,
    setPage, setSearch, refresh: fetchData,
    create, update, remove, doAction, postAction,
  };
}

// For non-paginated endpoints
export function useSimpleApi<T>(endpoint: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoint);
      const d = res.data?.data ?? res.data;
      setItems(Array.isArray(d) ? d : []);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'apiErrors.failedToLoad'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { items, loading, error, refresh: fetchData };
}
