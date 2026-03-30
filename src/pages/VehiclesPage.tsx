import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCrudApi } from '@/hooks/useCrudApi';
import DataTable, { type Column } from '@/components/shared/DataTable';
import StatusBadgeGeneric from '@/components/shared/StatusBadgeGeneric';
import FormDialog from '@/components/shared/FormDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/translateError';
import { useAuth } from '@/context/AuthContext';
import type { Vehicle } from '@/types/entities';

export default function VehiclesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'TRANSPORT_AUTHORITY';
  const { toast } = useToast();
  const { items, loading, error, page, search, setPage, setSearch, data, create, update } = useCrudApi<Vehicle>({ endpoint: '/vehicles' });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({
    registration_no: '', type: 'VAN' as 'VAN' | 'BUS', capacity: '', soft_overflow: '0',
    make: '', model: '', driver_name: '', driver_phone: '', driver_license_no: '',
  });

  const openCreate = () => {
    setEditItem(null);
    setForm({ registration_no: '', type: 'VAN', capacity: '', soft_overflow: '0', make: '', model: '', driver_name: '', driver_phone: '', driver_license_no: '' });
    setDialogOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditItem(v);
    setForm({
      registration_no: v.registration_no, type: v.type, capacity: String(v.capacity),
      soft_overflow: String(v.soft_overflow), make: v.make ?? '', model: v.model ?? '',
      driver_name: v.driver_name ?? '', driver_phone: v.driver_phone ?? '', driver_license_no: v.driver_license_no ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.registration_no || !form.capacity) {
      toast({ title: t('common.validationError'), description: t('vehicles.regNoCapacityRequired'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        registration_no: form.registration_no.trim(),
        type: form.type,
        capacity: Number(form.capacity),
        soft_overflow: Number(form.soft_overflow),
        make: form.make.trim() || undefined,
        model: form.model.trim() || undefined,
        driver_name: form.driver_name.trim() || undefined,
        driver_phone: form.driver_phone.trim() || undefined,
        driver_license_no: form.driver_license_no.trim() || undefined,
      };
      if (editItem) { await update(editItem.id, body as any); toast({ title: t('vehicles.vehicleUpdated') }); }
      else { await create(body as any); toast({ title: t('vehicles.vehicleCreated') }); }
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Vehicle>[] = [
    { key: 'id', label: t('common.id'), className: 'w-16' },
    { key: 'registration_no', label: t('vehicles.regNo') },
    { key: 'type', label: t('vehicles.type') },
    { key: 'capacity', label: t('vehicles.capacity'), className: 'w-20' },
    { key: 'soft_overflow', label: t('vehicles.overflow'), className: 'w-20' },
    { key: 'driver_name', label: t('vehicles.driverName'), render: (v) => v.driver_name || '—' },
    { key: 'driver_phone', label: t('vehicles.driverPhone'), render: (v) => v.driver_phone || '—' },
    { key: 'is_active', label: t('common.status'), render: (v) => <StatusBadgeGeneric status={v.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    ...(canManage ? [{ key: 'actions' as const, label: '', render: (v: Vehicle) => <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(v); }}>{t('common.edit')}</Button> }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('vehicles.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('vehicles.subtitle')}</p>
      </div>
      <DataTable
        columns={columns} items={items} loading={loading} error={error}
        search={search} onSearchChange={setSearch} searchPlaceholder={t('vehicles.searchPlaceholder')}
        page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage}
        onAdd={canManage ? openCreate : undefined} addLabel={t('vehicles.addVehicle')}
        onRowClick={canManage ? openEdit : undefined}
      />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editItem ? t('vehicles.editVehicle') : t('vehicles.addVehicle')} onSubmit={handleSubmit} loading={saving}>
        <div className="space-y-4">
          {/* Vehicle Info */}
          <p className="text-sm font-semibold text-foreground">{t('vehicles.vehicleInfo')}</p>
          <div>
            <Label>{t('vehicles.registrationNo')} *</Label>
            <Input value={form.registration_no} onChange={(e) => setForm(f => ({ ...f, registration_no: e.target.value }))} disabled={!!editItem} />
          </div>
          <div>
            <Label>{t('vehicles.type')} *</Label>
            <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as 'VAN' | 'BUS' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="VAN">{t('vehicles.van')}</SelectItem>
                <SelectItem value="BUS">{t('vehicles.bus')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t('vehicles.capacity')} *</Label><Input type="number" value={form.capacity} onChange={(e) => setForm(f => ({ ...f, capacity: e.target.value }))} /></div>
            <div><Label>{t('vehicles.softOverflow')}</Label><Input type="number" value={form.soft_overflow} onChange={(e) => setForm(f => ({ ...f, soft_overflow: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t('vehicles.make')}</Label><Input value={form.make} onChange={(e) => setForm(f => ({ ...f, make: e.target.value }))} /></div>
            <div><Label>{t('vehicles.model')}</Label><Input value={form.model} onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))} /></div>
          </div>

          {/* Driver Info */}
          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground mb-3">{t('vehicles.permanentDriver')}</p>
            <div className="space-y-3">
              <div><Label>{t('vehicles.driverName')}</Label><Input value={form.driver_name} onChange={(e) => setForm(f => ({ ...f, driver_name: e.target.value }))} placeholder={t('vehicles.driverNamePlaceholder')} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('vehicles.driverPhone')}</Label><Input value={form.driver_phone} onChange={(e) => setForm(f => ({ ...f, driver_phone: e.target.value }))} placeholder={t('vehicles.driverPhonePlaceholder')} /></div>
                <div><Label>{t('vehicles.driverLicense')}</Label><Input value={form.driver_license_no} onChange={(e) => setForm(f => ({ ...f, driver_license_no: e.target.value }))} placeholder={t('vehicles.driverLicensePlaceholder')} /></div>
              </div>
            </div>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
