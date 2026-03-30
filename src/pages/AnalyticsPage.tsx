import { useTranslation } from 'react-i18next';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Truck, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, loading } = useDashboardData(user?.role ?? 'EMP');
  const stats = data as any;

  const cards = [
    { label: t('analytics.dropOffRequests'), value: stats?.totalRequests ?? stats?.deptRequests ?? 0, icon: BarChart3, color: 'text-primary' },
    { label: t('analytics.totalEmployees'), value: stats?.totalEmployees ?? stats?.deptEmployees ?? 0, icon: Users, color: 'text-success' },
    { label: t('analytics.totalVehicles'), value: stats?.totalVehicles ?? 0, icon: Truck, color: 'text-warning' },
    { label: t('analytics.pending'), value: stats?.pendingRequests ?? stats?.pendingApprovals ?? 0, icon: TrendingUp, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('analytics.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('analytics.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold text-foreground">{c.value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('analytics.detailedAnalytics')}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('analytics.detailedDesc')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
