import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCrudApi } from '@/hooks/useCrudApi';
import api from '@/lib/api';
import DataTable, { type Column } from '@/components/shared/DataTable';
import StatusBadgeGeneric from '@/components/shared/StatusBadgeGeneric';
import FormDialog from '@/components/shared/FormDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2 } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/translateError';
import { Progress } from '@/components/ui/progress';
import * as XLSX from 'xlsx';
import type { Place } from '@/types/entities';

export default function PlacesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { items, loading, error, page, search, setPage, setSearch, data, create, update, refresh } = useCrudApi<Place>({ endpoint: '/places', defaultSort: 'title', defaultOrder: 'ASC' });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<Place | null>(null);
  const [form, setForm] = useState({ title: '', address: '', latitude: '', longitude: '' });
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openCreate = () => { setEditItem(null); setForm({ title: '', address: '', latitude: '', longitude: '' }); setDialogOpen(true); };
  const openEdit = (p: Place) => { setEditItem(p); setForm({ title: p.title, address: p.address ?? '', latitude: String(p.latitude), longitude: String(p.longitude) }); setDialogOpen(true); };

  const handleSubmit = async () => {
    if (!form.title || !form.latitude || !form.longitude) { toast({ title: t('places.titleAndCoordsRequired'), variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const body = { title: form.title.trim(), address: form.address.trim() || undefined, latitude: Number(form.latitude), longitude: Number(form.longitude) };
      if (editItem) { await update(editItem.id, body as any); toast({ title: t('places.placeUpdated') }); }
      else { await create(body as any); toast({ title: t('places.placeCreated') }); }
      setDialogOpen(false);
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      let allItems: any[];
      if (file.name.match(/\.xlsx?$/i)) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', raw: false, cellText: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('Excel file is empty');
        allItems = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '', blankrows: false });
      } else {
        const text = await file.text();
        allItems = JSON.parse(text);
      }
      if (!Array.isArray(allItems)) throw new Error('Imported data must be an array');
      const toNumber = (value: unknown): number | undefined => { const num = Number(value); return Number.isFinite(num) ? num : undefined; };
      const compactItems = allItems.map((item: any) => ({
        title: typeof item?.title === 'string' ? item.title.trim() : undefined,
        address: typeof item?.address === 'string' ? item.address.trim() : undefined,
        lat: toNumber(item?.lat ?? item?.location?.lat ?? item?.latitude),
        lng: toNumber(item?.lng ?? item?.location?.lng ?? item?.longitude),
        placeId: item?.placeId ?? item?.external_place_id,
      }));
      const BATCH = 200;
      const total = compactItems.length;
      let totalSuccess = 0, totalErrors = 0;
      setImportProgress({ done: 0, total });
      for (let i = 0; i < total; i += BATCH) {
        const batch = compactItems.slice(i, i + BATCH);
        const res = await api.post('/places/import', { items: batch }, { timeout: 600000 });
        const d = res.data?.data ?? res.data;
        totalSuccess += d?.success ?? 0;
        totalErrors += d?.errors ?? 0;
        setImportProgress({ done: Math.min(i + BATCH, total), total });
      }
      toast({ title: t('places.importComplete'), description: t('places.importResult', { success: totalSuccess, errors: totalErrors, total }) });
      refresh();
    } catch (err: any) {
      toast({ title: t('places.importFailed'), description: getApiErrorMessage(err), variant: 'destructive' });
    } finally {
      setImporting(false); setImportProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const columns: Column<Place>[] = [
    { key: 'id', label: t('common.id'), className: 'w-16' },
    { key: 'title', label: t('places.titleField') },
    { key: 'address', label: t('places.address'), render: (p) => p.address || '—' },
    { key: 'latitude', label: t('places.lat'), className: 'w-24' },
    { key: 'longitude', label: t('places.lng'), className: 'w-24' },
    { key: 'is_active', label: t('common.status'), render: (p) => <StatusBadgeGeneric status={p.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', label: '', render: (p: Place) => <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>{t('common.edit')}</Button> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('places.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('places.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".json,.xlsx,.xls" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {importing ? t('places.importing') : `${t('places.importJson')} / Excel`}
          </Button>
        </div>
      </div>
      {importProgress && (
        <div className="space-y-1">
          <Progress value={(importProgress.done / importProgress.total) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">{t('places.placesProcessed', { done: importProgress.done.toLocaleString(), total: importProgress.total.toLocaleString() })}</p>
        </div>
      )}
      <DataTable columns={columns} items={items} loading={loading} error={error} search={search} onSearchChange={setSearch} searchPlaceholder={t('places.searchPlaceholder')} page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} onAdd={openCreate} addLabel={t('places.addPlace')} onRowClick={openEdit} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editItem ? t('places.editPlace') : t('places.addPlace')} onSubmit={handleSubmit} loading={saving}>
        <div className="space-y-3">
          <div><Label>{t('places.titleField')} *</Label><Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><Label>{t('places.address')}</Label><Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t('places.latitude')} *</Label><Input type="number" step="any" value={form.latitude} onChange={(e) => setForm(f => ({ ...f, latitude: e.target.value }))} /></div>
            <div><Label>{t('places.longitude')} *</Label><Input type="number" step="any" value={form.longitude} onChange={(e) => setForm(f => ({ ...f, longitude: e.target.value }))} /></div>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
