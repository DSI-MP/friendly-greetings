import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, ChevronDown, Search, MapPin, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import type { Employee, Place } from '@/types/entities';

interface ApiResponse<T> { success?: boolean; data: T; }

export default function EmployeesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'HOD';
  const { toast } = useToast();
  const { items, loading, error, page, search, setPage, setSearch, data, create, update, refresh } = useCrudApi<Employee>({
    endpoint: '/employees', defaultSort: 'created_at', defaultOrder: 'DESC',
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<Employee | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', empNo: '', departmentId: '', password: '', confirmPassword: '', placeId: '' });
  const [activeTab, setActiveTab] = useState('all');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placeSearch, setPlaceSearch] = useState('');
  const [placeOpen, setPlaceOpen] = useState(false);

  useEffect(() => {
    const loadPlaces = async () => {
      setPlacesLoading(true);
      try {
        const privateRes = await api.get<ApiResponse<Place[]>>('/places', { params: { limit: 5000 } });
        const privateData = privateRes.data?.data ?? privateRes.data;
        const privateItems = Array.isArray(privateData) ? privateData : (privateData as any)?.items ?? [];
        if (privateItems.length > 0) {
          setPlaces(privateItems);
          return;
        }

        const publicRes = await api.get<ApiResponse<Place[]>>('/public/places');
        const publicData = publicRes.data?.data ?? publicRes.data;
        setPlaces(Array.isArray(publicData) ? publicData : (publicData as any)?.items ?? []);
      } catch (err) {
        try {
          const publicRes = await api.get<ApiResponse<Place[]>>('/public/places');
          const publicData = publicRes.data?.data ?? publicRes.data;
          setPlaces(Array.isArray(publicData) ? publicData : (publicData as any)?.items ?? []);
        } catch (fallbackErr) {
          setPlaces([]);
          toast({ title: t('common.error'), description: getApiErrorMessage(fallbackErr || err), variant: 'destructive' });
        }
      } finally {
        setPlacesLoading(false);
      }
    };

    loadPlaces();
  }, [t, toast]);

  useEffect(() => {
    if (!dialogOpen) {
      setPlaceOpen(false);
      setPlaceSearch('');
    }
  }, [dialogOpen]);

  const pending = useCrudApi<Employee>({ endpoint: '/employees/pending-self-registrations', defaultSort: 'created_at', autoFetch: activeTab === 'pending' });

  const openCreate = () => {
    setEditItem(null);
    setForm({ fullName: '', email: '', phone: '', empNo: '', departmentId: '', password: '', confirmPassword: '', placeId: '' });
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditItem(emp);
    setForm({ fullName: emp.full_name, email: emp.email, phone: emp.phone ?? '', empNo: emp.emp_no ?? '', departmentId: String(emp.department_id), password: '', confirmPassword: '', placeId: emp.place_id ? String(emp.place_id) : '' });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.departmentId) {
      toast({ title: t('common.validationError'), description: t('employees.nameEmailDeptRequired'), variant: 'destructive' });
      return;
    }

    if (!editItem) {
      if (!form.password || form.password.length < 6) {
        toast({ title: t('common.validationError'), description: t('forgotPassword.passwordMin'), variant: 'destructive' });
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast({ title: t('common.validationError'), description: t('forgotPassword.passwordsNotMatch'), variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      if (editItem) {
        await update(editItem.id, {
          full_name: form.fullName.trim(),
          email: form.email.toLowerCase().trim(),
          phone: form.phone.trim() || undefined,
          department_id: Number(form.departmentId),
          place_id: form.placeId ? Number(form.placeId) : undefined,
        } as any);
        toast({ title: t('employees.employeeUpdated') });
      } else {
        await create({
          fullName: form.fullName.trim(),
          email: form.email.toLowerCase().trim(),
          phone: form.phone.trim() || undefined,
          empNo: form.empNo.trim() || undefined,
          departmentId: Number(form.departmentId),
          placeId: form.placeId ? Number(form.placeId) : undefined,
          password: form.password,
          confirmPassword: form.confirmPassword,
        } as any);
        toast({ title: t('employees.employeeCreated') });
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await fetch(`/api/employees/${id}/approve-self-registration`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')}` } });
      toast({ title: t('employees.registrationApproved') });
      pending.refresh();
      refresh();
    } catch {
      toast({ title: t('common.error'), description: t('employees.failedToApprove'), variant: 'destructive' });
    }
  };

  const selectedPlace = places.find((p) => p.id === Number(form.placeId));
  const filteredPlaces = places.filter((p) =>
    p.title.toLowerCase().includes(placeSearch.toLowerCase()) ||
    (p.address?.toLowerCase().includes(placeSearch.toLowerCase()))
  );

  const columns: Column<Employee>[] = [
    { key: 'id', label: t('common.id'), className: 'w-16' },
    { key: 'full_name', label: t('common.name') },
    { key: 'email', label: t('common.email') },
    { key: 'emp_no', label: t('employees.empNo'), render: (e) => e.emp_no || '—' },
    { key: 'department_id', label: t('employees.deptId'), className: 'w-20' },
    {
      key: 'place_id', label: t('employees.dropOffLocation'), render: (e) => {
        const place = places.find(p => p.id === e.place_id);
        return place ? place.title : '—';
      },
    },
    { key: 'status', label: t('common.status'), render: (e) => <StatusBadgeGeneric status={e.status} /> },
    ...(isAdmin ? [{ key: 'actions' as const, label: t('common.actions'), render: (e: Employee) => <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}>{t('common.edit')}</Button> }] : []),
  ];

  const pendingColumns: Column<Employee>[] = [
    { key: 'id', label: t('common.id'), className: 'w-16' },
    { key: 'full_name', label: t('common.name') },
    { key: 'email', label: t('common.email') },
    { key: 'register_as', label: t('employees.registerAs'), render: (e) => e.register_as ?? '—' },
    { key: 'department_id', label: t('employees.deptId'), className: 'w-20' },
    { key: 'created_at', label: t('employees.submitted'), render: (e) => new Date(e.created_at).toLocaleDateString() },
    { key: 'actions', label: t('common.actions'), render: (e: Employee) => <Button size="sm" onClick={(ev) => { ev.stopPropagation(); handleApprove(e.id); }}>{t('employees.approve')}</Button> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('employees.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('employees.subtitle')}</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">{t('employees.allEmployees')}</TabsTrigger>
          <TabsTrigger value="pending">{t('employees.pendingRegistrations')}</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <DataTable columns={columns} items={items} loading={loading} error={error} search={search} onSearchChange={setSearch} searchPlaceholder={t('employees.searchPlaceholder')} page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} onAdd={isAdmin ? openCreate : undefined} addLabel={t('employees.addEmployee')} onRowClick={isAdmin ? openEdit : undefined} />
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          <DataTable columns={pendingColumns} items={pending.items} loading={pending.loading} error={pending.error} emptyMessage={t('employees.noPendingRegistrations')} />
        </TabsContent>
      </Tabs>
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editItem ? t('employees.editEmployee') : t('employees.addEmployee')} onSubmit={handleSubmit} loading={saving}>
        <div className="space-y-3">
          <div><Label>{t('employees.fullName')} *</Label><Input value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
          <div><Label>{t('common.email')} *</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><Label>{t('common.phone')}</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          {!editItem && <div><Label>{t('employees.empNo')}</Label><Input value={form.empNo} onChange={(e) => setForm(f => ({ ...f, empNo: e.target.value }))} /></div>}
          <div><Label>{t('employees.departmentId')} *</Label><Input type="number" value={form.departmentId} onChange={(e) => setForm(f => ({ ...f, departmentId: e.target.value }))} /></div>

          <div>
            <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" /> {t('employees.dropOffLocation')}</Label>
            <div className="relative mt-1">
              <button
                type="button"
                onClick={() => setPlaceOpen((v) => !v)}
                disabled={placesLoading}
                className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className={selectedPlace ? 'text-foreground' : 'text-muted-foreground'}>
                  {placesLoading ? 'Loading places…' : selectedPlace ? selectedPlace.title : t('employees.selectDropOff')}
                </span>
                {placesLoading ? <Loader2 size={16} className="animate-spin text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </button>
              {placeOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                  <div className="sticky top-0 bg-card p-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-xs" placeholder={t('common.search')} value={placeSearch} onChange={(e) => setPlaceSearch(e.target.value)} autoFocus />
                    </div>
                  </div>
                  {filteredPlaces.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{t('common.noResults')}</p>}
                  {filteredPlaces.map((p) => (
                    <button key={p.id} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors" onClick={() => { setForm(f => ({ ...f, placeId: String(p.id) })); setPlaceOpen(false); setPlaceSearch(''); }}>
                      <span className="font-medium">{p.title}</span>
                      {p.address && <span className="ml-2 text-xs text-muted-foreground">— {p.address}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!editItem && (
            <>
              <div>
                <Label>{t('auth.password')} *</Label>
                <div className="relative mt-1">
                  <Input type={showPw ? 'text' : 'password'} placeholder={t('forgotPassword.minChars')} value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} className="pr-10" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <Label>{t('register.confirmPassword')} *</Label>
                <div className="relative mt-1">
                  <Input type={showCpw ? 'text' : 'password'} placeholder={t('forgotPassword.reenterPassword')} value={form.confirmPassword} onChange={(e) => setForm(f => ({ ...f, confirmPassword: e.target.value }))} className="pr-10" />
                  <button type="button" onClick={() => setShowCpw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showCpw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </FormDialog>
    </div>
  );
}
