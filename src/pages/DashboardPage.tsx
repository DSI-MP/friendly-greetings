import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useDashboardData, type AdminDashboard, type HodDashboard, type HrDashboard, type TaDashboard, type PlanningDashboard } from '@/hooks/useDashboardData';
import { useDailyLock } from '@/hooks/useDailyLock';
import StatsCard from '@/components/dashboard/StatsCard';
import QuickActions from '@/components/dashboard/QuickActions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { FileText, Users, Truck, UserCog, Building2, ClipboardCheck, Plus, BarChart3, Settings, Route, MapPin, Loader2, Lock, Unlock, ShieldAlert, Sparkles } from 'lucide-react';
import type { Role } from '@/types/auth';

function DailyLockPanel() {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const { isLocked, loading, actionLoading, lock, unlock, approvedRequestCount } = useDailyLock(selectedDate);

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t('dashboard.checkingLock')}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className={`${isLocked ? 'border-destructive/30 bg-destructive/5' : 'border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5'}`}>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            {isLocked ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <Lock className="h-5 w-5 text-destructive" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--success))]/10">
                <Unlock className="h-5 w-5 text-[hsl(var(--success))]" />
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground text-sm">{t('dashboard.dailyRun', { date: selectedDate })}</p>
              <p className="text-xs text-muted-foreground">
                {isLocked ? t('dashboard.lockedDesc') : t('dashboard.unlockedDesc')}
                {!isLocked && ` · ${approvedRequestCount} approved request(s) ready`}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 w-[172px]"
            />
            {isLocked ? (
              <Button variant="outline" size="sm" onClick={unlock} disabled={actionLoading} className="gap-1.5 rounded-xl">
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                {t('dashboard.unlock')}
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={lock} disabled={actionLoading || approvedRequestCount === 0} className="gap-1.5 rounded-xl">
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                {t('dashboard.lockDailyRun')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function WelcomeBanner({ name, role }: { name: string; role: string }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="welcome-banner"
    >
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-white/70" />
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">{t('dashboard.title')}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {t('dashboard.welcomeBack')}{' '}
            <span className="text-white/90">{name}</span>
          </h1>
          <span className="inline-flex items-center rounded-lg bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-white/90 uppercase tracking-wide">
            {t(`dashboard.roles.${role}`)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function AdminView({ data }: { data: AdminDashboard }) {
  const { t } = useTranslation();
  return (
    <>
      <DailyLockPanel />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatsCard title={t('dashboard.dropOffRequests')} value={data.totalRequests} icon={FileText} />
        <StatsCard title={t('common.pending')} value={data.pendingRequests} icon={ClipboardCheck} description={t('dashboard.pendingApproval')} />
        <StatsCard title={t('dashboard.employees')} value={data.totalEmployees} icon={Users} />
        <StatsCard title={t('dashboard.vehicles')} value={data.totalVehicles} icon={Truck} />
        <StatsCard title={t('dashboard.drivers')} value={data.totalDrivers} icon={UserCog} />
        <StatsCard title={t('dashboard.departments')} value={data.totalDepartments} icon={Building2} />
      </div>
      <QuickActions actions={[
        { label: t('dashboard.newDropOffRequest'), icon: Plus, to: '/requests/create', variant: 'default' },
        { label: t('dashboard.viewReports'), icon: BarChart3, to: '/analytics' },
        { label: t('dashboard.manageUsers'), icon: Users, to: '/users' },
        { label: t('dashboard.settings'), icon: Settings, to: '/settings' },
      ]} />
    </>
  );
}

function HodLockedBanner() {
  const { t } = useTranslation();
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 shrink-0">
          <ShieldAlert className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <p className="font-semibold text-destructive text-sm">{t('dashboard.dailyRunLocked')}</p>
          <p className="text-xs text-muted-foreground">{t('dashboard.dailyRunLockedDesc')}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HodView({ data }: { data: HodDashboard }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const { isLocked, loading } = useDailyLock(today);

  return (
    <>
      {!loading && isLocked && <HodLockedBanner />}
      <div className="grid grid-cols-2 gap-3">
        <StatsCard title={t('dashboard.deptDropOffRequests')} value={data.deptRequests} icon={FileText} />
        <StatsCard title={t('dashboard.deptEmployees')} value={data.deptEmployees} icon={Users} />
      </div>
      <QuickActions actions={[
        ...(!isLocked ? [{ label: t('dashboard.newDropOffRequest'), icon: Plus, to: '/requests/create', variant: 'default' as const }] : []),
        { label: t('dashboard.myRequests'), icon: ClipboardCheck, to: '/hod/requests' },
        { label: t('dashboard.employees'), icon: Users, to: '/employees' },
      ]} />
    </>
  );
}

function HrView({ data }: { data: HrDashboard }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatsCard title={t('dashboard.pendingHrReview')} value={data.pendingHR} icon={ClipboardCheck} description={t('dashboard.awaitingFinalApproval')} />
        <StatsCard title={t('dashboard.hrApproved')} value={data.approved} icon={ClipboardCheck} />
      </div>
      <QuickActions actions={[
        { label: t('dashboard.finalApprovals'), icon: ClipboardCheck, to: '/hr/approvals', variant: 'default' },
        { label: t('dashboard.analytics'), icon: BarChart3, to: '/analytics' },
        { label: t('dashboard.employees'), icon: Users, to: '/employees' },
      ]} />
    </>
  );
}

function TaView({ data }: { data: TaDashboard }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatsCard title={t('dashboard.pendingGrouping')} value={data.pendingGrouping} icon={FileText} description={t('dashboard.awaitingGrouping')} />
        <StatsCard title={t('dashboard.processing')} value={data.processing} icon={Truck} />
      </div>
      <QuickActions actions={[
        { label: t('dashboard.dropOffQueue'), icon: FileText, to: '/ta/processing', variant: 'default' },
        { label: t('dashboard.vehicles'), icon: Truck, to: '/vehicles' },
        { label: t('dashboard.drivers'), icon: UserCog, to: '/drivers' },
        { label: t('sidebar.routes'), icon: Route, to: '/routes' },
      ]} />
    </>
  );
}

function PlanningView({ data }: { data: PlanningDashboard }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatsCard title={t('dashboard.activeVehicles')} value={data.totalVehicles} icon={Truck} />
        <StatsCard title={t('dashboard.activeDrivers')} value={data.totalDrivers} icon={UserCog} />
      </div>
      <QuickActions actions={[
        { label: t('dashboard.vehicles'), icon: Truck, to: '/vehicles', variant: 'default' },
        { label: t('dashboard.drivers'), icon: UserCog, to: '/drivers' },
        { label: t('dashboard.analytics'), icon: BarChart3, to: '/analytics' },
      ]} />
    </>
  );
}

function EmpView() {
  const { t } = useTranslation();
  return (
    <QuickActions actions={[
      { label: t('dashboard.myDropOffDetails'), icon: FileText, to: '/emp/transport', variant: 'default' },
      { label: t('dashboard.updateDestination'), icon: MapPin, to: '/emp/self-service' },
    ]} />
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role ?? 'EMP';
  const { data, loading, error } = useDashboardData(role);

  return (
    <div className="space-y-6">
      <WelcomeBanner name={user?.fullName ?? ''} role={role} />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {(role === 'ADMIN' || role === 'SUPER_ADMIN') && data && <AdminView data={data as AdminDashboard} />}
          {role === 'HOD' && data && <HodView data={data as HodDashboard} />}
          {role === 'HR' && data && <HrView data={data as HrDashboard} />}
          {role === 'TRANSPORT_AUTHORITY' && data && <TaView data={data as TaDashboard} />}
          {role === 'PLANNING' && data && <PlanningView data={data as PlanningDashboard} />}
          {role === 'EMP' && <EmpView />}
        </>
      )}
    </div>
  );
}
