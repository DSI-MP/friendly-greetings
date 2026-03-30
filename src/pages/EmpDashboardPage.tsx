import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useEmpDashboard } from '@/hooks/useEmpDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bus, Phone, Copy, MessageSquare, MapPin, AlertTriangle,
  FileText, Bell, User, ChevronRight, Calendar, Route,
  Truck, UserCog, ClipboardList, Loader2, BellOff, Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import type { EmpTransport } from '@/types/emp';

function TransportStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline" className="text-xs">Unknown</Badge>;
  const map: Record<string, { label: string; className: string }> = {
    DISPATCHED: { label: 'Dispatched', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400' },
    CONFIRMED: { label: 'Confirmed', className: 'bg-blue-500/15 text-blue-700 border-blue-200 dark:text-blue-400' },
    PENDING: { label: 'Pending', className: 'bg-amber-500/15 text-amber-700 border-amber-200 dark:text-amber-400' },
    CLOSED: { label: 'Completed', className: 'bg-muted text-muted-foreground border-border' },
    CANCELLED: { label: 'Cancelled', className: 'bg-destructive/15 text-destructive border-destructive/20' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return <Badge variant="outline" className={`text-xs ${s.className}`}>{s.label}</Badge>;
}

function IssueStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Pending', className: 'bg-amber-500/15 text-amber-700 border-amber-200' },
    IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-500/15 text-blue-700 border-blue-200' },
    RESOLVED: { label: 'Resolved', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
    APPROVED: { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
    REJECTED: { label: 'Rejected', className: 'bg-destructive/15 text-destructive border-destructive/20' },
    CLOSED: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return <Badge variant="outline" className={`text-xs ${s.className}`}>{s.label}</Badge>;
}

export default function EmpDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, loading } = useEmpDashboard();
  const navigate = useNavigate();
  const { toast } = useToast();

  const today = data?.today_transport;

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast({ title: t('empDashboard.phoneNumberCopied') });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          {t('empDashboard.welcomeBack', { name: user?.fullName || data?.employee?.full_name || 'Employee' })}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('empDashboard.subtitle')}</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">{t('empDashboard.employee')}</Badge>
          {today ? <TransportStatusBadge status={today.status} /> : <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">{t('empDashboard.noDropOffToday')}</Badge>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Bus className="h-4 w-4 text-primary" />{t('empDashboard.todaysDropOff')}</CardTitle></CardHeader>
        <CardContent>
          {today ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoItem icon={<Calendar className="h-3.5 w-3.5" />} label={t('common.date')} value={today.request_date} />
                <InfoItem icon={<Route className="h-3.5 w-3.5" />} label={t('empDashboard.corridor')} value={today.route_name || '—'} />
                <InfoItem icon={<Shield className="h-3.5 w-3.5" />} label={t('empDashboard.group')} value={today.group_code || '—'} />
                <InfoItem icon={<Truck className="h-3.5 w-3.5" />} label={t('empDashboard.vehicle')} value={today.registration_no || '—'} />
                <InfoItem icon={<UserCog className="h-3.5 w-3.5" />} label={t('empDashboard.driver')} value={today.driver_name || '—'} />
                <InfoItem icon={<Phone className="h-3.5 w-3.5" />} label={t('empDashboard.driverPhone')} value={today.driver_phone || '—'} />
              </div>
              {(today.drop_note || today.pickup_note) && (
                <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                  <p><span className="font-medium text-foreground">{t('empDashboard.dropOff')}</span> <span className="text-muted-foreground">{today.drop_note || today.pickup_note}</span></p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <TransportStatusBadge status={today.status} />
                {today.driver_phone && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => window.open(`tel:${today.driver_phone}`)}><Phone className="h-3 w-3" /> {t('empDashboard.call')}</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => copyPhone(today.driver_phone!)}><Copy className="h-3 w-3" /> {t('empDashboard.copy')}</Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => window.open(`https://wa.me/${today.driver_phone!.replace(/[^0-9]/g, '')}`)}><MessageSquare className="h-3 w-3" /> WhatsApp</Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Bus className="h-7 w-7 text-muted-foreground/50" /></div>
              <p className="mt-3 text-sm font-medium text-foreground">{t('empDashboard.noAssignmentToday')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('empDashboard.checkBackLater')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {today?.driver_name && today?.driver_phone && (
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"><UserCog className="h-5 w-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{today.driver_name}</p>
              <p className="text-xs text-muted-foreground">{today.driver_phone} · {today.registration_no || t('empDashboard.vehicleTbd')}</p>
            </div>
            <div className="flex gap-1.5">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => window.open(`tel:${today.driver_phone}`)}><Phone className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => window.open(`https://wa.me/${today.driver_phone!.replace(/[^0-9]/g, '')}`)}><MessageSquare className="h-3.5 w-3.5" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{t('empDashboard.quickActions')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <QuickAction icon={<MapPin className="h-5 w-5" />} label={t('empDashboard.updateDestination')} onClick={() => navigate('/emp/self-service')} />
            <QuickAction icon={<AlertTriangle className="h-5 w-5" />} label={t('empDashboard.reportIssue')} onClick={() => navigate('/emp/self-service')} />
            <QuickAction icon={<User className="h-5 w-5" />} label={t('empDashboard.myProfile')} onClick={() => navigate('/emp/profile')} />
            <QuickAction icon={<Bell className="h-5 w-5" />} label={t('sidebar.notifications')} onClick={() => navigate('/emp/notifications')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-primary" /> {t('empDashboard.recentNotifications')}</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => navigate('/emp/notifications')}>{t('common.viewAll')} <ChevronRight className="h-3 w-3" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-6 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-xs text-muted-foreground">{t('empDashboard.noNewNotifications')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-primary" /> {t('empDashboard.recentHistory')}</CardTitle></CardHeader>
        <CardContent>
          {data?.recent_trips && data.recent_trips.length > 0 ? (
            <div className="space-y-2">{data.recent_trips.map((trip, i) => <TripRow key={i} trip={trip} />)}</div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">{t('empDashboard.noRecentHistory')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {((data?.pending_issues?.length ?? 0) > 0 || (data?.pending_location_requests?.length ?? 0) > 0) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-primary" /> {t('empDashboard.myRequestsIssues')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.pending_issues?.map((issue) => (
              <div key={issue.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{issue.subject}</p>
                  <p className="text-xs text-muted-foreground">{new Date(issue.created_at).toLocaleDateString()}</p>
                </div>
                <IssueStatusBadge status={issue.status} />
              </div>
            ))}
            {data?.pending_location_requests?.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{t('empDashboard.destinationChangeRequest')}</p>
                  <p className="text-xs text-muted-foreground">{req.reason || `${req.lat}, ${req.lng}`} · {new Date(req.created_at).toLocaleDateString()}</p>
                </div>
                <IssueStatusBadge status={req.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:bg-accent hover:border-accent">
      <div className="text-primary">{icon}</div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  );
}

function TripRow({ trip }: { trip: EmpTransport }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Bus className="h-4 w-4 text-muted-foreground" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{trip.route_name || 'Corridor N/A'}</p>
        <p className="text-xs text-muted-foreground">{trip.request_date} · {trip.registration_no || 'N/A'} · {trip.driver_name || 'N/A'}</p>
      </div>
      <TransportStatusBadge status={trip.status} />
    </div>
  );
}
