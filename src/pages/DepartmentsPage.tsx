import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCrudApi } from '@/hooks/useCrudApi';
import DataTable, { type Column } from '@/components/shared/DataTable';
import StatusBadgeGeneric from '@/components/shared/StatusBadgeGeneric';
import FormDialog from '@/components/shared/FormDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/translateError';
import type { Department } from '@/types/entities';

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { items, loading, error, page, search, setPage, setSearch, data, create, update } = useCrudApi<Department>({ endpoint: '/departments', defaultSort: 'name', defaultOrder: 'ASC' });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', code: '' });

  const openCreate = () => { setEditItem(null); setForm({ name: '', code: '' }); setDialogOpen(true); };
  const openEdit = (d: Department) => { setEditItem(d); setForm({ name: d.name, code: d.code ?? '' }); setDialogOpen(true); };

  const handleSubmit = async () => {
    if (!form.name) { toast({ title: t('departments.nameRequired'), variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const body = { name: form.name.trim(), code: form.code.trim() || undefined };
      if (editItem) { await update(editItem.id, body as any); toast({ title: t('departments.departmentUpdated') }); }
      else { await create(body as any); toast({ title: t('departments.departmentCreated') }); }
      setDialogOpen(false);
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const columns: Column<Department>[] = [
    { key: 'id', label: t('common.id'), className: 'w-16' },
    { key: 'name', label: t('common.name') },
    { key: 'code', label: t('departments.code'), render: (d) => d.code || '—' },
    { key: 'is_active', label: t('common.status'), render: (d) => <StatusBadgeGeneric status={d.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', label: '', render: (d: Department) => <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(d); }}>{t('common.edit')}</Button> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('departments.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('departments.subtitle')}</p>
      </div>
      <DataTable columns={columns} items={items} loading={loading} error={error} search={search} onSearchChange={setSearch} searchPlaceholder={t('departments.searchPlaceholder')} page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} onAdd={openCreate} addLabel={t('departments.addDepartment')} onRowClick={openEdit} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editItem ? t('departments.editDepartment') : t('departments.addDepartment')} onSubmit={handleSubmit} loading={saving}>
        <div className="space-y-3">
          <div><Label>{t('common.name')} *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>{t('departments.code')}</Label><Input value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} placeholder={t('departments.codePlaceholder')} /></div>
        </div>
      </FormDialog>
    </div>
  );
}
