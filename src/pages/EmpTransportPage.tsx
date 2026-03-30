import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, FileText } from 'lucide-react';
import api from '@/lib/api';
import type { EmpTransport } from '@/types/emp';

function StatusBadge({ status }: { status?: string | null }) {
  const map: Record<string, string> = {
    DISPATCHED: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
    CONFIRMED: 'bg-blue-500/15 text-blue-700 border-blue-200',
    PENDING: 'bg-amber-500/15 text-amber-700 border-amber-200',
    CLOSED: 'bg-muted text-muted-foreground border-border',
  };
  return <Badge variant="outline" className={`text-xs ${map[status || ''] || 'bg-muted text-muted-foreground border-border'}`}>{status || 'Unknown'}</Badge>;
}

export default function EmpTransportPage() {
  const { t } = useTranslation();
  const [trips, setTrips] = useState<EmpTransport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/self-service/transport-history'); const d = res.data?.data ?? res.data; setTrips(Array.isArray(d) ? d : []); }
    catch { setTrips([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('empTransport.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('empTransport.subtitle')}</p>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">{t('empTransport.noHistory')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('empTransport.historyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{trip.request_date}</span>
                  </div>
                  <StatusBadge status={trip.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-xs text-muted-foreground">{t('empTransport.corridor')}</span><p className="font-medium text-foreground">{trip.route_name || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">{t('empTransport.vehicle')}</span><p className="font-medium text-foreground">{trip.registration_no || '—'} {trip.vehicle_type && <span className="text-xs text-muted-foreground">({trip.vehicle_type})</span>}</p></div>
                  <div><span className="text-xs text-muted-foreground">{t('empTransport.driver')}</span><p className="font-medium text-foreground">{trip.driver_name || '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">{t('empTransport.group')}</span><p className="font-medium text-foreground">{trip.group_code || '—'}</p></div>
                </div>
                {(trip.drop_note || trip.pickup_note) && (
                  <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium">{t('empTransport.dropOffNote')}</span> {trip.drop_note || trip.pickup_note}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
