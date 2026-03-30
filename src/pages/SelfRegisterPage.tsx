import { useState, useEffect, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle, ChevronDown, Search, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthLayout from '@/components/auth/AuthLayout';
import api from '@/lib/api';
import type { Department, SelfRegisterRequest, ApiResponse } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/translateError';

interface PlaceOption { id: number; title: string; address?: string; }

export default function SelfRegisterPage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const [form, setForm] = useState<SelfRegisterRequest & { placeId?: number }>({
    fullName: '', email: '', phone: '', departmentId: 0, registerAs: 'EMP', empNo: '', password: '', confirmPassword: '',
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptSearch, setDeptSearch] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);

  // Places
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [placeSearch, setPlaceSearch] = useState('');
  const [placeOpen, setPlaceOpen] = useState(false);

  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<ApiResponse<Department[]>>('/public/departments')
      .then((r) => setDepartments(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setDepartments([]));
    api.get<ApiResponse<PlaceOption[]>>('/public/places')
      .then((r) => setPlaces(Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []))
      .catch(() => setPlaces([]));
  }, []);

  const set = (key: string, val: string | number) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = t('register.fullNameRequired');
    if (!form.email.trim()) e.email = t('auth.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('auth.emailInvalid');
    if (!form.phone.trim()) e.phone = t('register.phoneRequired');
    if (!form.departmentId) e.departmentId = t('register.selectDeptRequired');
    if (!form.placeId) e.placeId = t('register.selectDropOffRequired');
    if (!form.empNo?.trim()) e.empNo = t('register.empNoRequired');
    if (!form.password) e.password = t('forgotPassword.passwordRequired');
    else if (form.password.length < 6) e.password = t('forgotPassword.passwordMin');
    if (form.password !== form.confirmPassword) e.confirmPassword = t('forgotPassword.passwordsNotMatch');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post('/employees/self-register', {
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setDone(true);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'register.registrationFailed');
      toast({ variant: 'destructive', title: t('forgotPassword.error'), description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDept = departments.find((d) => d.id === form.departmentId);
  const filteredDepts = departments.filter((d) => d.name.toLowerCase().includes(deptSearch.toLowerCase()));
  const selectedPlace = places.find((p) => p.id === form.placeId);
  const filteredPlaces = places.filter((p) =>
    p.title.toLowerCase().includes(placeSearch.toLowerCase()) ||
    (p.address?.toLowerCase().includes(placeSearch.toLowerCase()))
  );

  if (done) {
    const approvalMsg = form.registerAs === 'HOD' ? t('register.hodApprovalMsg') : t('register.empApprovalMsg');

    return (
      <AuthLayout title={t('register.registrationSubmitted')} showBackToLogin>
        <div className="flex flex-col items-center gap-4 py-4 text-center animate-slide-up">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle size={32} className="text-success" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t('register.requestSent')}</h2>
          <p className="text-sm text-muted-foreground">{approvalMsg}</p>
          <p className="text-xs text-muted-foreground">{t('register.notificationMsg')}</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('register.title')} subtitle={t('register.subtitle')} showBackToLogin>
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <Field label={t('register.fullName')} error={errors.fullName}>
          <input className="auth-input" placeholder={t('register.fullNamePlaceholder')} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>

        <Field label={t('register.workEmail')} error={errors.email}>
          <input className="auth-input" type="email" placeholder={t('auth.emailPlaceholder')} value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>

        <Field label={t('register.phone')} error={errors.phone}>
          <input className="auth-input" placeholder={t('register.phonePlaceholder')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>

        {/* Department selector */}
        <Field label={t('register.department')} error={errors.departmentId}>
          <div className="relative">
            <button type="button" onClick={() => setDeptOpen((v) => !v)} className="auth-input flex items-center justify-between text-left">
              <span className={selectedDept ? 'text-foreground' : 'text-muted-foreground'}>{selectedDept?.name || t('register.selectDepartment')}</span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>
            {deptOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                <div className="sticky top-0 bg-card p-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input className="auth-input pl-8 py-2 text-xs" placeholder={t('common.search')} value={deptSearch} onChange={(e) => setDeptSearch(e.target.value)} autoFocus />
                  </div>
                </div>
                {filteredDepts.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{t('register.noDepts')}</p>}
                {filteredDepts.map((d) => (
                  <button key={d.id} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors" onClick={() => { set('departmentId', d.id); setDeptOpen(false); setDeptSearch(''); }}>{d.name}</button>
                ))}
              </div>
            )}
          </div>
        </Field>

        {/* Drop-off Location selector */}
        <Field label={t('register.dropOffLocation')} error={errors.placeId}>
          <div className="relative">
            <button type="button" onClick={() => setPlaceOpen((v) => !v)} className="auth-input flex items-center justify-between text-left">
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="text-primary shrink-0" />
                <span className={selectedPlace ? 'text-foreground' : 'text-muted-foreground'}>
                  {selectedPlace ? selectedPlace.title : t('register.selectDropOff')}
                </span>
              </span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>
            {placeOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                <div className="sticky top-0 bg-card p-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input className="auth-input pl-8 py-2 text-xs" placeholder={t('common.search')} value={placeSearch} onChange={(e) => setPlaceSearch(e.target.value)} autoFocus />
                  </div>
                </div>
                {filteredPlaces.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{t('common.noResults')}</p>}
                {filteredPlaces.map((p) => (
                  <button key={p.id} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors" onClick={() => { set('placeId', p.id); setPlaceOpen(false); setPlaceSearch(''); }}>
                    <span className="font-medium">{p.title}</span>
                    {p.address && <span className="text-xs text-muted-foreground ml-2">— {p.address}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field label={t('register.registerAs')}>
          <div className="flex gap-3">
            {(['EMP', 'HOD'] as const).map((r) => (
              <label key={r} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm transition-all data-[active=true]:border-primary data-[active=true]:bg-accent" data-active={form.registerAs === r}>
                <input type="radio" name="registerAs" value={r} checked={form.registerAs === r} onChange={() => set('registerAs', r)} className="sr-only" />
                {r === 'EMP' ? t('register.employee') : t('register.headOfDept')}
              </label>
            ))}
          </div>
        </Field>

        <Field label={t('register.empNo')} error={errors.empNo}>
          <input className="auth-input" placeholder={t('register.empNoPlaceholder')} value={form.empNo} onChange={(e) => set('empNo', e.target.value)} />
        </Field>

        <Field label={t('auth.password')} error={errors.password}>
          <div className="relative">
            <input className="auth-input pr-10" type={showPw ? 'text' : 'password'} placeholder={t('forgotPassword.minChars')} value={form.password} onChange={(e) => set('password', e.target.value)} />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <Field label={t('register.confirmPassword')} error={errors.confirmPassword}>
          <div className="relative">
            <input className="auth-input pr-10" type={showCpw ? 'text' : 'password'} placeholder={t('forgotPassword.reenterPassword')} value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} />
            <button type="button" onClick={() => setShowCpw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
              {showCpw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <div className="rounded-lg bg-accent/60 px-3 py-2 text-xs text-accent-foreground">
          {form.registerAs === 'HOD' ? t('register.hodApprovalInfo') : t('register.empApprovalInfo')}
        </div>

        <button type="submit" disabled={submitting} className="btn-auth-primary">
          {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
          {submitting ? t('register.submitting') : t('register.submitRegistration')}
        </button>
      </form>
    </AuthLayout>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="auth-label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
