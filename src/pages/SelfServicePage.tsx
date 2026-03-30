import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { MapPin, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/translateError';

export default function SelfServicePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ lat: '', lng: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.lat || !form.lng) { toast({ title: t('selfService.coordsRequired'), variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const empId = user?.employeeId ?? user?.sub;
      await api.post(`/employees/${empId}/location-change-request`, { lat: Number(form.lat), lng: Number(form.lng), reason: form.reason.trim() || undefined });
      toast({ title: t('selfService.submitted') });
      setForm({ lat: '', lng: '', reason: '' });
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('selfService.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('selfService.subtitle')}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> {t('selfService.requestDestChange')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('selfService.destDesc')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t('selfService.latitude')} *</Label><Input type="number" step="any" value={form.lat} onChange={(e) => setForm(f => ({ ...f, lat: e.target.value }))} /></div>
            <div><Label>{t('selfService.longitude')} *</Label><Input type="number" step="any" value={form.lng} onChange={(e) => setForm(f => ({ ...f, lng: e.target.value }))} /></div>
          </div>
          <div><Label>{t('selfService.reason')}</Label><Textarea value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={t('selfService.reasonPlaceholder')} /></div>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} {t('selfService.submitRequest')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
