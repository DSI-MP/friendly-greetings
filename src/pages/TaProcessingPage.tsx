import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWorkflowApi } from '@/hooks/useWorkflowApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Cog, Users, Truck, Calendar, Loader2, Building2, Route } from 'lucide-react';

interface LockedDate {
  id: number;
  lock_date: string;
  locked_request_count: number;
  total_employee_count: number;
  locked_at: string;
  daily_run_id?: number;
  daily_run_status?: string;
  department_count?: number;
  total_groups?: number;
}

export default function TaProcessingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const api = useWorkflowApi();
  const [lockedDates, setLockedDates] = useState<LockedDate[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [runningDate, setRunningDate] = useState<string | null>(null);

  useEffect(() => {
    setPageLoading(true);
    api.fetchLockedDates().then((dates: any[]) => {
      setLockedDates(dates);
      setPageLoading(false);
    }).catch(() => setPageLoading(false));
  }, [api.fetchLockedDates]);

  const handleRunGrouping = async (date: string) => {
    setRunningDate(date);
    try {
      await api.runDailyGrouping(date);
      navigate(`/ta/assignments/daily/${date}`);
    } catch {
      setRunningDate(null);
    }
  };

  const handleViewRun = async (date: string) => {
    navigate(`/ta/assignments/daily/${date}`);
  };

  const totalRequests = lockedDates.reduce((a, d) => a + (d.locked_request_count || 0), 0);
  const totalEmployees = lockedDates.reduce((a, d) => a + (d.total_employee_count || 0), 0);
  const totalDepts = lockedDates.reduce((a, d) => a + (d.department_count || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('taProcessingPage.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('taProcessingPage.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Calendar className="h-8 w-8 text-primary" />
          <div><p className="text-2xl font-bold text-foreground">{lockedDates.length}</p><p className="text-xs text-muted-foreground">{t('taProcessingPage.lockedDates')}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Truck className="h-8 w-8 text-primary" />
          <div><p className="text-2xl font-bold text-foreground">{totalRequests}</p><p className="text-xs text-muted-foreground">{t('taProcessingPage.totalRequests')}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-[hsl(var(--warning))]" />
          <div><p className="text-2xl font-bold text-foreground">{totalEmployees}</p><p className="text-xs text-muted-foreground">{t('taProcessingPage.totalEmployees')}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Building2 className="h-8 w-8 text-[hsl(var(--success))]" />
          <div><p className="text-2xl font-bold text-foreground">{totalDepts}</p><p className="text-xs text-muted-foreground">{t('taProcessingPage.departments')}</p></div>
        </CardContent></Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">{t('taProcessingPage.lockedDailyBatches')}</h2>
        {pageLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : lockedDates.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Cog className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">{t('taProcessingPage.noLockedBatches')}</p>
            <p className="text-sm text-muted-foreground">{t('taProcessingPage.noLockedBatchesDesc')}</p>
          </CardContent></Card>
        ) : lockedDates.map(d => {
          const dateStr = typeof d.lock_date === 'string' ? d.lock_date.split('T')[0] : d.lock_date;
          const hasGrouping = d.daily_run_status && ['GROUPED', 'ASSIGNING', 'READY', 'SUBMITTED_TO_HR', 'DISPATCHED'].includes(d.daily_run_status);
          return (
            <Card key={d.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">{dateStr}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.locked_request_count} {t('taProcessingPage.requests')} · {d.total_employee_count} {t('taProcessingPage.employees')}
                        {d.department_count ? ` · ${d.department_count} ${t('taProcessingPage.depts')}` : ''}
                        {` · ${t('taProcessingPage.locked')} `}
                        {new Date(d.locked_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{d.locked_request_count} {t('taProcessingPage.requests')}</Badge>
                    <Badge variant="outline">{d.total_employee_count} {t('taAssignmentPage.emp')}</Badge>
                    {d.daily_run_status && (
                      <Badge variant={hasGrouping ? 'default' : 'secondary'} className="text-[10px]">
                        {d.daily_run_status}
                      </Badge>
                    )}
                    {d.total_groups ? (
                      <Badge variant="outline" className="text-[10px]">
                        <Route className="h-2.5 w-2.5 mr-1" />{d.total_groups} {t('taProcessingPage.groups')}
                      </Badge>
                    ) : null}
                    <Button
                      onClick={() => handleRunGrouping(dateStr)}
                      disabled={runningDate === dateStr}
                      size="sm"
                    >
                      {runningDate === dateStr ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Cog className="mr-1.5 h-4 w-4" />}
                      {hasGrouping ? t('taProcessingPage.rerunGrouping') : t('taProcessingPage.runGrouping')}
                    </Button>
                    {hasGrouping && (
                      <Button variant="outline" size="sm" onClick={() => handleViewRun(dateStr)}>
                        {t('taProcessingPage.viewResults')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
