import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCrudApi } from '@/hooks/useCrudApi';
import DataTable, { type Column } from '@/components/shared/DataTable';
import StatusBadgeGeneric from '@/components/shared/StatusBadgeGeneric';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, ShieldCheck, KeyRound } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/translateError';
import type { User } from '@/types/entities';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-destructive/15 text-destructive border-destructive/30',
  ADMIN: 'bg-primary/15 text-primary border-primary/30',
  HOD: 'bg-warning/15 text-warning border-warning/30',
  HR: 'bg-accent text-accent-foreground border-accent',
  TRANSPORT_AUTHORITY: 'bg-success/15 text-success border-success/30',
  EMP: 'bg-muted text-muted-foreground border-border',
  PLANNING: 'bg-secondary text-secondary-foreground border-border',
};

export default function UsersPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { items, loading, error, page, search, setPage, setSearch, data, doAction } = useCrudApi<User>({ endpoint: '/users' });

  const [resetDialog, setResetDialog] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleSuspend = async (u: User) => {
    try { await doAction(u.id, 'suspend'); toast({ title: t('users.suspended', { name: u.full_name }) }); }
    catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
  };
  const handleReactivate = async (u: User) => {
    try { await doAction(u.id, 'reactivate'); toast({ title: t('users.reactivated', { name: u.full_name }) }); }
    catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
  };
  const handleResetPassword = async () => {
    if (!resetDialog || newPassword.length < 6) { toast({ title: t('users.passwordMinChars'), variant: 'destructive' }); return; }
    setResetting(true);
    try { await doAction(resetDialog.id, 'reset-password', { newPassword }); toast({ title: t('users.passwordResetSuccess') }); setResetDialog(null); setNewPassword(''); }
    catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setResetting(false); }
  };

  const columns: Column<User>[] = [
    { key: 'id', label: t('common.id'), className: 'w-16' },
    { key: 'full_name', label: t('common.name') },
    { key: 'email', label: t('common.email') },
    { key: 'role', label: t('users.role'), render: (u) => <Badge variant="outline" className={`text-xs ${ROLE_COLORS[u.role] ?? ''}`}>{u.role}</Badge> },
    { key: 'status', label: t('common.status'), render: (u) => <StatusBadgeGeneric status={u.status} /> },
    { key: 'last_login_at', label: t('users.lastLogin'), render: (u) => u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : t('users.never') },
    {
      key: 'actions', label: t('common.actions'), render: (u: User) => (
        <div className="flex gap-1">
          {u.status === 'ACTIVE' ? (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleSuspend(u); }}>
              <ShieldAlert className="mr-1 h-3.5 w-3.5" /> {t('users.suspend')}
            </Button>
          ) : u.status === 'SUSPENDED' ? (
            <Button variant="ghost" size="sm" className="text-success" onClick={(e) => { e.stopPropagation(); handleReactivate(u); }}>
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> {t('users.reactivate')}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setResetDialog(u); setNewPassword(''); }}>
            <KeyRound className="mr-1 h-3.5 w-3.5" /> {t('users.resetPw')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('users.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('users.subtitle')}</p>
      </div>
      <DataTable columns={columns} items={items} loading={loading} error={error} search={search} onSearchChange={setSearch} searchPlaceholder={t('users.searchPlaceholder')} page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      <Dialog open={!!resetDialog} onOpenChange={(o) => !o && setResetDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('users.resetPassword')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('users.resetPasswordFor')} <strong>{resetDialog?.full_name}</strong></p>
          <div><Label>{t('users.newPassword')}</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('users.minChars')} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleResetPassword} disabled={resetting}>{t('users.resetPassword')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
