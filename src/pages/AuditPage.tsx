import { useTranslation } from 'react-i18next';
import { useCrudApi } from '@/hooks/useCrudApi';
import DataTable, { type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import type { AuditLog } from '@/types/entities';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-success/15 text-success border-success/30',
  UPDATE: 'bg-primary/15 text-primary border-primary/30',
  DELETE: 'bg-destructive/15 text-destructive border-destructive/30',
  LOGIN: 'bg-accent text-accent-foreground border-accent',
  APPROVE: 'bg-success/15 text-success border-success/30',
  REJECT: 'bg-destructive/15 text-destructive border-destructive/30',
  SUSPEND: 'bg-warning/15 text-warning border-warning/30',
};

export default function AuditPage() {
  const { t } = useTranslation();
  const { items, loading, error, page, search, setPage, setSearch, data } = useCrudApi<AuditLog>({
    endpoint: '/audit-logs',
    defaultSort: 'created_at',
    defaultOrder: 'DESC',
  });

  const columns: Column<AuditLog>[] = [
    { key: 'id', label: t('common.id'), className: 'w-16' },
    { key: 'action', label: t('audit.action'), render: (a) => <Badge variant="outline" className={`text-xs ${ACTION_COLORS[a.action] ?? 'bg-muted text-muted-foreground'}`}>{a.action}</Badge> },
    { key: 'entity_type', label: t('audit.entity') },
    { key: 'entity_id', label: t('audit.entityId'), render: (a) => a.entity_id ?? '—', className: 'w-20' },
    { key: 'performed_by_user_id', label: t('audit.userId'), render: (a) => a.performed_by_user_id ?? '—', className: 'w-20' },
    { key: 'ip_address', label: t('audit.ip'), render: (a) => a.ip_address || '—' },
    { key: 'created_at', label: t('common.date'), render: (a) => new Date(a.created_at).toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('audit.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
      </div>
      <DataTable columns={columns} items={items} loading={loading} error={error} search={search} onSearchChange={setSearch} searchPlaceholder={t('audit.searchPlaceholder')} page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </div>
  );
}
