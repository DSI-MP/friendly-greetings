import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCrudApi } from '@/hooks/useCrudApi';
import DataTable, { type Column } from '@/components/shared/DataTable';
import StatusBadgeGeneric from '@/components/shared/StatusBadgeGeneric';
import FormDialog from '@/components/shared/FormDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/translateError';
import type { RouteItem, RouteCorridor } from '@/types/entities';

export default function RoutesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [tab, setTab] = useState('routes');

  const routes = useCrudApi<RouteItem>({ endpoint: '/routes', defaultSort: 'code', defaultOrder: 'ASC' });
  const [routeDialog, setRouteDialog] = useState(false);
  const [editRoute, setEditRoute] = useState<RouteItem | null>(null);
  const [routeForm, setRouteForm] = useState({ code: '', name: '', description: '', bearing_from_depot: '' });
  const [savingRoute, setSavingRoute] = useState(false);

  const corridors = useCrudApi<RouteCorridor>({ endpoint: '/corridors', defaultSort: 'name', defaultOrder: 'ASC', autoFetch: tab === 'corridors' });
  const [corridorDialog, setCorridorDialog] = useState(false);
  const [editCorridor, setEditCorridor] = useState<RouteCorridor | null>(null);
  const [corridorForm, setCorridorForm] = useState({ name: '', bearing_start: '', bearing_end: '', description: '' });
  const [savingCorridor, setSavingCorridor] = useState(false);

  const openCreateRoute = () => { setEditRoute(null); setRouteForm({ code: '', name: '', description: '', bearing_from_depot: '' }); setRouteDialog(true); };
  const openEditRoute = (r: RouteItem) => { setEditRoute(r); setRouteForm({ code: r.code, name: r.name, description: r.description ?? '', bearing_from_depot: r.bearing_from_depot ? String(r.bearing_from_depot) : '' }); setRouteDialog(true); };

  const submitRoute = async () => {
    if (!routeForm.code || !routeForm.name) { toast({ title: t('routes.codeAndNameRequired'), variant: 'destructive' }); return; }
    setSavingRoute(true);
    try {
      const body = { code: routeForm.code.trim(), name: routeForm.name.trim(), description: routeForm.description.trim() || undefined, bearing_from_depot: routeForm.bearing_from_depot ? Number(routeForm.bearing_from_depot) : undefined };
      if (editRoute) { await routes.update(editRoute.id, body as any); toast({ title: t('routes.routeUpdated') }); }
      else { await routes.create(body as any); toast({ title: t('routes.routeCreated') }); }
      setRouteDialog(false);
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setSavingRoute(false); }
  };

  const openCreateCorridor = () => { setEditCorridor(null); setCorridorForm({ name: '', bearing_start: '', bearing_end: '', description: '' }); setCorridorDialog(true); };
  const openEditCorridor = (c: RouteCorridor) => { setEditCorridor(c); setCorridorForm({ name: c.name, bearing_start: c.bearing_start ? String(c.bearing_start) : '', bearing_end: c.bearing_end ? String(c.bearing_end) : '', description: c.description ?? '' }); setCorridorDialog(true); };

  const submitCorridor = async () => {
    if (!corridorForm.name) { toast({ title: t('departments.nameRequired'), variant: 'destructive' }); return; }
    setSavingCorridor(true);
    try {
      const body = { name: corridorForm.name.trim(), bearing_start: corridorForm.bearing_start ? Number(corridorForm.bearing_start) : undefined, bearing_end: corridorForm.bearing_end ? Number(corridorForm.bearing_end) : undefined, description: corridorForm.description.trim() || undefined };
      if (editCorridor) { await corridors.update(editCorridor.id, body as any); toast({ title: t('routes.corridorUpdated') }); }
      else { await corridors.create(body as any); toast({ title: t('routes.corridorCreated') }); }
      setCorridorDialog(false);
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setSavingCorridor(false); }
  };

  const routeColumns: Column<RouteItem>[] = [
    { key: 'id', label: t('common.id'), className: 'w-16' },
    { key: 'code', label: t('routes.code') },
    { key: 'name', label: t('common.name') },
    { key: 'bearing_from_depot', label: t('routes.bearing'), render: (r) => r.bearing_from_depot ? `${r.bearing_from_depot}°` : '—' },
    { key: 'corridor_id', label: t('routes.corridor'), render: (r) => r.corridor_id ?? '—', className: 'w-20' },
    { key: 'is_active', label: t('common.status'), render: (r) => <StatusBadgeGeneric status={r.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', label: '', render: (r: RouteItem) => <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditRoute(r); }}>{t('common.edit')}</Button> },
  ];

  const corridorColumns: Column<RouteCorridor>[] = [
    { key: 'id', label: t('common.id'), className: 'w-16' },
    { key: 'name', label: t('common.name') },
    { key: 'bearing_start', label: `${t('routes.bearingStart').split('(')[0]}`, render: (c) => c.bearing_start ?? '—' },
    { key: 'bearing_end', label: `${t('routes.bearingEnd').split('(')[0]}`, render: (c) => c.bearing_end ?? '—' },
    { key: 'description', label: t('common.description'), render: (c) => c.description || '—' },
    { key: 'is_active', label: t('common.status'), render: (c) => <StatusBadgeGeneric status={c.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', label: '', render: (c: RouteCorridor) => <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditCorridor(c); }}>{t('common.edit')}</Button> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('routes.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('routes.subtitle')}</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="routes">{t('routes.routesTab')}</TabsTrigger><TabsTrigger value="corridors">{t('routes.corridorsTab')}</TabsTrigger></TabsList>
        <TabsContent value="routes" className="mt-4">
          <DataTable columns={routeColumns} items={routes.items} loading={routes.loading} error={routes.error} search={routes.search} onSearchChange={routes.setSearch} searchPlaceholder={t('routes.searchRoutes')} page={routes.page} totalPages={routes.data?.totalPages ?? 1} onPageChange={routes.setPage} onAdd={openCreateRoute} addLabel={t('routes.addRoute')} onRowClick={openEditRoute} />
        </TabsContent>
        <TabsContent value="corridors" className="mt-4">
          <DataTable columns={corridorColumns} items={corridors.items} loading={corridors.loading} error={corridors.error} search={corridors.search} onSearchChange={corridors.setSearch} searchPlaceholder={t('routes.searchCorridors')} page={corridors.page} totalPages={corridors.data?.totalPages ?? 1} onPageChange={corridors.setPage} onAdd={openCreateCorridor} addLabel={t('routes.addCorridor')} onRowClick={openEditCorridor} />
        </TabsContent>
      </Tabs>

      <FormDialog open={routeDialog} onOpenChange={setRouteDialog} title={editRoute ? t('routes.editRoute') : t('routes.addRoute')} onSubmit={submitRoute} loading={savingRoute}>
        <div className="space-y-3">
          <div><Label>{t('routes.code')} *</Label><Input value={routeForm.code} onChange={(e) => setRouteForm(f => ({ ...f, code: e.target.value }))} /></div>
          <div><Label>{t('common.name')} *</Label><Input value={routeForm.name} onChange={(e) => setRouteForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>{t('routes.bearingFromDepot')}</Label><Input type="number" step="any" value={routeForm.bearing_from_depot} onChange={(e) => setRouteForm(f => ({ ...f, bearing_from_depot: e.target.value }))} /></div>
          <div><Label>{t('common.description')}</Label><Textarea value={routeForm.description} onChange={(e) => setRouteForm(f => ({ ...f, description: e.target.value }))} /></div>
        </div>
      </FormDialog>

      <FormDialog open={corridorDialog} onOpenChange={setCorridorDialog} title={editCorridor ? t('routes.editCorridor') : t('routes.addCorridor')} onSubmit={submitCorridor} loading={savingCorridor}>
        <div className="space-y-3">
          <div><Label>{t('common.name')} *</Label><Input value={corridorForm.name} onChange={(e) => setCorridorForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t('routes.bearingStart')}</Label><Input type="number" step="any" value={corridorForm.bearing_start} onChange={(e) => setCorridorForm(f => ({ ...f, bearing_start: e.target.value }))} /></div>
            <div><Label>{t('routes.bearingEnd')}</Label><Input type="number" step="any" value={corridorForm.bearing_end} onChange={(e) => setCorridorForm(f => ({ ...f, bearing_end: e.target.value }))} /></div>
          </div>
          <div><Label>{t('common.description')}</Label><Textarea value={corridorForm.description} onChange={(e) => setCorridorForm(f => ({ ...f, description: e.target.value }))} /></div>
        </div>
      </FormDialog>
    </div>
  );
}
