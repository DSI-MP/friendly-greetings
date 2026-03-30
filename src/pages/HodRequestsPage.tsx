import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useWorkflowApi } from '@/hooks/useWorkflowApi';
import { useDailyLock } from '@/hooks/useDailyLock';
import RequestSummaryCard from '@/components/workflow/RequestSummaryCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileText, Clock, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import type { RequestDetail } from '@/types/workflow';

export default function HodRequestsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { fetchRequests, loading } = useWorkflowApi();
  const [requests, setRequests] = useState<RequestDetail[]>([]);
  const [tab, setTab] = useState('all');

  const today = new Date().toISOString().split('T')[0];
  const { isLocked, loading: lockLoading } = useDailyLock(today);

  useEffect(() => {
    fetchRequests().then(setRequests);
  }, [fetchRequests]);

  const filtered = requests.filter(r => {
    if (tab === 'drafts') return r.status === 'DRAFT';
    if (tab === 'submitted') return r.status === 'SUBMITTED';
    if (tab === 'approved')
      return ['ADMIN_APPROVED', 'DAILY_LOCKED', 'TA_PROCESSING', 'GROUPING_COMPLETED', 'TA_COMPLETED', 'HR_APPROVED', 'DISPATCHED', 'CLOSED'].includes(r.status);
    if (tab === 'rejected')
      return ['ADMIN_REJECTED', 'HR_REJECTED', 'CANCELLED'].includes(r.status);
    return true;
  });

  const counts = {
    all: requests.length,
    drafts: requests.filter(r => r.status === 'DRAFT').length,
    submitted: requests.filter(r => r.status === 'SUBMITTED').length,
    approved: requests.filter(r =>
      ['ADMIN_APPROVED', 'DAILY_LOCKED', 'TA_PROCESSING', 'GROUPING_COMPLETED', 'TA_COMPLETED', 'HR_APPROVED', 'DISPATCHED', 'CLOSED'].includes(r.status),
    ).length,
    rejected: requests.filter(r =>
      ['ADMIN_REJECTED', 'HR_REJECTED', 'CANCELLED'].includes(r.status),
    ).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('hodRequests.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('hodRequests.subtitle')}</p>
        </div>
        {!isLocked && (
          <Button onClick={() => navigate('/requests/create')} className="gap-1.5">
            <Plus className="h-4 w-4" />{t('hodRequests.newRequest')}
          </Button>
        )}
      </div>

      {!lockLoading && isLocked && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <ShieldAlert className="h-6 w-6 text-destructive shrink-0" />
            <div>
              <p className="font-semibold text-destructive text-sm">{t('hodRequests.dailyRunLocked')}</p>
              <p className="text-xs text-muted-foreground">{t('hodRequests.dailyRunLockedDesc')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('hodRequests.total'), count: counts.all, icon: FileText, color: 'text-primary' },
          { label: t('hodRequests.pending'), count: counts.submitted, icon: Clock, color: 'text-[hsl(var(--warning))]' },
          { label: t('hodRequests.approved'), count: counts.approved, icon: CheckCircle, color: 'text-[hsl(var(--success))]' },
          { label: t('hodRequests.rejected'), count: counts.rejected, icon: XCircle, color: 'text-destructive' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{t('common.all')} ({counts.all})</TabsTrigger>
          <TabsTrigger value="drafts">{t('hodRequests.drafts')} ({counts.drafts})</TabsTrigger>
          <TabsTrigger value="submitted">{t('hodRequests.submitted')} ({counts.submitted})</TabsTrigger>
          <TabsTrigger value="approved">{t('hodRequests.approved')} ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">{t('hodRequests.rejected')} ({counts.rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-medium text-foreground">{t('hodRequests.noRequests')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {tab === 'drafts' ? t('hodRequests.createToStart') : t('hodRequests.noMatch')}
                </p>
              </CardContent>
            </Card>
          ) : (
            filtered.map(req => (
              <RequestSummaryCard key={req.id} request={req} onClick={() => navigate(`/requests/${req.id}`)} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
