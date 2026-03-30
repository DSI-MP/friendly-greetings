import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/transport/StatusBadge';
import RequestActions from '@/components/transport/RequestActions';
import CreateRequestDialog from '@/components/transport/CreateRequestDialog';
import { useTransportRequests } from '@/hooks/useTransportRequests';
import { useAuth } from '@/context/AuthContext';
import type { RequestStatus } from '@/types/transport';

export default function TransportRequestsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, loading, error, filters, setPage, setStatus, refresh } = useTransportRequests();
  const [createOpen, setCreateOpen] = useState(false);

  const canCreate = user?.role === 'HOD' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
    { value: 'DRAFT', label: t('transportRequests.draft') },
    { value: 'SUBMITTED', label: t('transportRequests.submitted') },
    { value: 'ADMIN_APPROVED', label: t('transportRequests.adminApproved') },
    { value: 'ADMIN_REJECTED', label: t('transportRequests.adminRejected') },
    { value: 'DAILY_LOCKED', label: t('transportRequests.dailyLocked') },
    { value: 'TA_PROCESSING', label: t('transportRequests.taProcessing') },
    { value: 'HR_APPROVED', label: t('transportRequests.hrApproved') },
    { value: 'DISPATCHED', label: t('transportRequests.dispatched') },
    { value: 'CLOSED', label: t('transportRequests.closed') },
  ];

  const getDeptName = (req: any) =>
    req.department?.name || `Dept ${req.department_id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('transportRequests.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('transportRequests.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={refresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> {t('transportRequests.newRequest')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={filters.status ?? 'ALL'}
          onValueChange={v => setStatus(v === 'ALL' ? undefined : v as RequestStatus)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('transportRequests.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('transportRequests.allStatuses')}</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
                {t('common.retry')}
              </Button>
            </div>
          ) : !data?.items.length ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">{t('transportRequests.noRequestsFound')}</p>
              {canCreate && (
                <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> {t('transportRequests.createFirst')}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t('common.id')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('transportRequests.dept')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('common.notes')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('transportRequests.created')}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">#{req.id}</TableCell>
                    <TableCell className="font-medium">
                      {new Date(req.request_date).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {getDeptName(req)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-sm text-muted-foreground">
                      {req.notes || '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString('en-GB')}
                    </TableCell>
                    <TableCell>
                      {user && <RequestActions request={req} role={user.role} onActionComplete={refresh} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('common.page')} {data.page} {t('common.of')} {data.totalPages} · {data.total} {t('common.total')}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
              {t('common.previous')}
            </Button>
            <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => setPage(data.page + 1)}>
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}

      <CreateRequestDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
    </div>
  );
}
