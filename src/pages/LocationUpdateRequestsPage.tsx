import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Check, X, Loader2, Search, Clock, CheckCircle2, XCircle, MapPinned } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/translateError';

interface LocationRequest {
  id: number;
  user_id: number;
  employee_id?: number;
  place_id: number;
  place_title?: string;
  lat: number;
  lng: number;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: number;
  review_note?: string;
  reviewed_at?: string;
  created_at: string;
}

export default function LocationUpdateRequestsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LocationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [actionDialog, setActionDialog] = useState<{ req: LocationRequest; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/self-service/location-changes', {
        params: { status: tab, _t: Date.now() },
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      });
      const raw = res.data?.data ?? res.data;
      setRequests(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      console.error('[LocationChanges] fetch failed:', err);
      toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tab, toast, t]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async () => {
    if (!actionDialog) return;
    setSubmitting(true);
    try {
      const url = `/self-service/location-changes/${actionDialog.req.id}/${actionDialog.action}`;
      await api.patch(url, { note: note.trim() || undefined });
      toast({ title: actionDialog.action === 'approve' ? t('locationRequests.approved') : t('locationRequests.rejected') });
      setActionDialog(null);
      setNote('');
      fetchRequests();
    } catch (err: any) {
      toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const filtered = requests.filter(r =>
    !search || (r.place_title || '').toLowerCase().includes(search.toLowerCase()) ||
    String(r.employee_id).includes(search) || String(r.user_id).includes(search)
  );

  const statusIcon = (s: string) => {
    if (s === 'APPROVED') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (s === 'REJECTED') return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-amber-500" />;
  };

  const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (s === 'APPROVED') return 'default';
    if (s === 'REJECTED') return 'destructive';
    return 'secondary';
  };

  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('locationRequests.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('locationRequests.subtitle')}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="PENDING" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> {t('common.pending')}</TabsTrigger>
            <TabsTrigger value="APPROVED" className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {t('common.approved')}</TabsTrigger>
            <TabsTrigger value="REJECTED" className="gap-1.5"><XCircle className="h-3.5 w-3.5" /> {t('common.rejected')}</TabsTrigger>
          </TabsList>
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('common.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <TabsContent key={s} value={s}>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> {t('common.loading')}
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <MapPinned className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">{t('locationRequests.noRequests')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                <AnimatePresence>
                  {filtered.map((req, i) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <MapPin className="h-5 w-5 text-primary" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-foreground">{req.place_title || `Place #${req.place_id}`}</span>
                                <Badge variant={statusVariant(req.status)} className="gap-1 text-xs">
                                  {statusIcon(req.status)} {req.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t('locationRequests.employeeId')}: {req.employee_id ?? req.user_id} · {t('locationRequests.coords')}: {Number(req.lat).toFixed(5)}, {Number(req.lng).toFixed(5)}
                              </p>
                              {req.reason && <p className="text-xs text-muted-foreground italic">"{req.reason}"</p>}
                              <p className="text-[10px] text-muted-foreground/70">{new Date(req.created_at).toLocaleString()}</p>
                              {req.review_note && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <span className="font-medium">{t('locationRequests.adminNote')}:</span> {req.review_note}
                                </p>
                              )}
                            </div>
                            {req.status === 'PENDING' && (
                              <div className="flex gap-2 shrink-0">
                                <Button size="sm" onClick={() => { setActionDialog({ req, action: 'approve' }); setNote(''); }} className="gap-1">
                                  <Check className="h-3.5 w-3.5" /> {t('common.approved')}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setActionDialog({ req, action: 'reject' }); setNote(''); }} className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                                  <X className="h-3.5 w-3.5" /> {t('common.rejected')}
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={v => !v && setActionDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === 'approve' ? t('locationRequests.approveTitle') : t('locationRequests.rejectTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium">{actionDialog?.req.place_title}</span>
            </div>
            {actionDialog?.action === 'approve' && (
              <p className="text-xs text-muted-foreground">{t('locationRequests.approveDesc')}</p>
            )}
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('locationRequests.notePlaceholder')}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={submitting}>{t('common.cancel')}</Button>
            <Button
              onClick={handleAction}
              disabled={submitting}
              variant={actionDialog?.action === 'reject' ? 'destructive' : 'default'}
              className="gap-1.5"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {actionDialog?.action === 'approve' ? t('locationRequests.confirmApprove') : t('locationRequests.confirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
