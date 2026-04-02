import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { MapPin, AlertTriangle, Loader2, Send, Info, Calendar, FileText } from 'lucide-react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/translateError';

export default function EmpSelfServicePage() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [locName, setLocName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [reason, setReason] = useState('');
  const [locSubmitting, setLocSubmitting] = useState(false);

  const [issueForm, setIssueForm] = useState({ subject: '', description: '' });
  const [issueSubmitting, setIssueSubmitting] = useState(false);

  // Date-based transport lookup
  const [lookupDate, setLookupDate] = useState('');
  const [lookupEntries, setLookupEntries] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  const submitLocation = async () => {
    const name = locName.trim();
    if (!name) { toast({ title: t('empSelfService.nameRequired'), variant: 'destructive' }); return; }
    if (!lat || !lng) { toast({ title: t('empSelfService.coordsRequired'), variant: 'destructive' }); return; }
    setLocSubmitting(true);
    try {
      await api.post('/self-service/location-change', {
        locationName: name,
        lat: Number(lat),
        lng: Number(lng),
        reason: reason.trim() || undefined,
      });
      toast({ title: t('empSelfService.destChangeSubmitted') });
      setLocName(''); setLat(''); setLng(''); setReason('');
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setLocSubmitting(false); }
  };

  const submitIssue = async () => {
    if (!issueForm.subject.trim()) { toast({ title: t('empSelfService.subjectRequired'), variant: 'destructive' }); return; }
    setIssueSubmitting(true);
    try {
      await api.post('/self-service/issues', { subject: issueForm.subject.trim(), description: issueForm.description.trim() || undefined });
      toast({ title: t('empSelfService.issueSubmitted') });
      setIssueForm({ subject: '', description: '' });
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setIssueSubmitting(false); }
  };

  const lookupTransport = useCallback(async () => {
    if (!lookupDate) return;
    setLookupLoading(true);
    try {
      const res = await api.get('/self-service/transport-history', { params: { date: lookupDate } });
      const d = res.data?.data ?? res.data;
      setLookupEntries(Array.isArray(d) ? d : []);
    } catch {
      setLookupEntries([]);
    } finally {
      setLookupLoading(false);
    }
  }, [lookupDate]);

  useEffect(() => {
    if (lookupDate) lookupTransport();
  }, [lookupDate, lookupTransport]);

  const statusColor: Record<string, string> = {
    DISPATCHED: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
    CONFIRMED: 'bg-blue-500/15 text-blue-700 border-blue-200',
    PENDING: 'bg-amber-500/15 text-amber-700 border-amber-200',
    CLOSED: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('empSelfService.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('empSelfService.subtitle')}</p>
      </div>
      <Tabs defaultValue="transport" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="transport" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> My Transport</TabsTrigger>
          <TabsTrigger value="location" className="gap-1.5"><MapPin className="h-3.5 w-3.5" /> {t('empSelfService.destinationChange')}</TabsTrigger>
          <TabsTrigger value="issue" className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> {t('empSelfService.reportIssue')}</TabsTrigger>
        </TabsList>

        {/* ── Transport Lookup by Date ── */}
        <TabsContent value="transport">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" /> View My Transport Entries
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Select a date to see your submitted transport requests for that day.</p>
              <div>
                <Label>Select Date</Label>
                <Input type="date" value={lookupDate} onChange={e => setLookupDate(e.target.value)} />
              </div>

              {lookupLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
              ) : lookupDate && lookupEntries.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-2 text-sm font-medium text-foreground">No entries found</p>
                  <p className="text-xs text-muted-foreground">No transport requests found for {lookupDate}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lookupEntries.map((entry, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">{entry.request_date || lookupDate}</span>
                        </div>
                        <Badge variant="outline" className={`text-xs ${statusColor[entry.status] || ''}`}>
                          {entry.status || 'Unknown'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Destination</span>
                          <p className="font-medium text-foreground">{entry.route_name || '—'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vehicle</span>
                          <p className="font-medium text-foreground">{entry.registration_no || '—'} {entry.vehicle_type && <span className="text-muted-foreground">({entry.vehicle_type})</span>}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Driver</span>
                          <p className="font-medium text-foreground">{entry.driver_name || '—'}</p>
                        </div>
                        {entry.driver_phone && (
                          <div>
                            <span className="text-muted-foreground">Driver Phone</span>
                            <p className="font-medium text-foreground">{entry.driver_phone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> {t('empSelfService.requestDestChange')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-primary/30 bg-primary/5">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs text-foreground/80">
                  {t('empSelfService.locationNameNote')}
                </AlertDescription>
              </Alert>
              <p className="text-xs text-muted-foreground">{t('empSelfService.destChangeDesc')}</p>
              <div>
                <Label>{t('empSelfService.locationName')} *</Label>
                <Input value={locName} onChange={e => setLocName(e.target.value)} placeholder={t('empSelfService.locationNamePlaceholder')} maxLength={255} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('empSelfService.latitude')} *</Label><Input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="e.g. 6.9271" /></div>
                <div><Label>{t('empSelfService.longitude')} *</Label><Input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="e.g. 79.8612" /></div>
              </div>
              <div><Label>{t('empSelfService.reason')}</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={t('empSelfService.reasonPlaceholder')} rows={3} maxLength={500} /></div>
              <Button onClick={submitLocation} disabled={locSubmitting || !locName.trim() || !lat || !lng} className="gap-1.5">
                {locSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t('empSelfService.submitRequest')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issue">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-primary" /> {t('empSelfService.submitIssue')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>{t('empSelfService.subject')} *</Label><Input value={issueForm.subject} onChange={e => setIssueForm(f => ({ ...f, subject: e.target.value }))} placeholder={t('empSelfService.subjectPlaceholder')} maxLength={255} /></div>
              <div><Label>{t('common.description')}</Label><Textarea value={issueForm.description} onChange={e => setIssueForm(f => ({ ...f, description: e.target.value }))} placeholder={t('empSelfService.descriptionPlaceholder')} rows={4} maxLength={1000} /></div>
              <Button onClick={submitIssue} disabled={issueSubmitting} className="gap-1.5">
                {issueSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t('empSelfService.submitIssue')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
