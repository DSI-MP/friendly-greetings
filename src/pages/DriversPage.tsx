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
import { useAuth } from '@/context/AuthContext';
import type { Driver } from '@/types/entities';

export default function DriversPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const { toast } = useToast();
  const { items, loading, error, page, search, setPage, setSearch, data, create, update } = useCrudApi<Driver>({ endpoint: '/drivers' });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<Driver | null>(null);
  const [form, setForm] = useState({ full_name: '', phone: '', license_no: '', default_vehicle_id: '' });

  const openCreate = () => { setEditItem(null); setForm({ full_name: '', phone: '', license_no: '', default_vehicle_id: '' }); setDialogOpen(true); };
  const openEdit = (d: Driver) => {
    setEditItem(d);
    setForm({ full_name: d.full_name, phone: d.phone, license_no: d.license_no ?? '', default_vehicle_id: d.default_vehicle_id ? String(d.default_vehicle_id) : '' });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.phone) {
      toast({ title: t('common.validationError'), description: t('drivers.namePhoneRequired'), variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const body = { full_name: form.full_name.trim(), phone: form.phone.trim(), license_no: form.license_no.trim() || undefined, default_vehicle_id: form.default_vehicle_id ? Number(form.default_vehicle_id) : undefined };
      if (editItem) { await update(editItem.id, body as any); toast({ title: t('drivers.driverUpdated') }); }
      else { await create(body as any); toast({ title: t('drivers.driverCreated') }); }
      setDialogOpen(false);
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const columns: Column<Driver>[] = [
    { key: 'id', label: t('common.id'), className: 'w-16' },
    { key: 'full_name', label: t('common.name') },
    { key: 'phone', label: t('common.phone') },
    { key: 'license_no', label: t('drivers.licenseNo'), render: (d) => d.license_no || '—' },
    { key: 'default_vehicle_id', label: t('drivers.vehicleId'), render: (d) => d.default_vehicle_id ?? '—', className: 'w-24' },
    { key: 'is_active', label: t('common.status'), render: (d) => <StatusBadgeGeneric status={d.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    ...(isAdmin ? [{ key: 'actions' as const, label: '', render: (d: Driver) => <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(d); }}>{t('common.edit')}</Button> }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('drivers.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('drivers.subtitle')}</p>
      </div>
      <DataTable columns={columns} items={items} loading={loading} error={error} search={search} onSearchChange={setSearch} searchPlaceholder={t('drivers.searchPlaceholder')} page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} onAdd={isAdmin ? openCreate : undefined} addLabel={t('drivers.addDriver')} onRowClick={isAdmin ? openEdit : undefined} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editItem ? t('drivers.editDriver') : t('drivers.addDriver')} onSubmit={handleSubmit} loading={saving}>
        <div className="space-y-3">
          <div><Label>{t('drivers.fullName')} *</Label><Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div><Label>{t('common.phone')} *</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div><Label>{t('drivers.licenseNo')}</Label><Input value={form.license_no} onChange={(e) => setForm(f => ({ ...f, license_no: e.target.value }))} /></div>
          <div><Label>{t('drivers.defaultVehicleId')}</Label><Input type="number" value={form.default_vehicle_id} onChange={(e) => setForm(f => ({ ...f, default_vehicle_id: e.target.value }))} /></div>
        </div>
      </FormDialog>
    </div>
  );
}
