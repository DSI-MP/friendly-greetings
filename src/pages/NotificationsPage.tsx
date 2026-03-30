import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Notification } from '@/types/entities';

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/notifications'); const d = res.data?.data ?? res.data; setItems(Array.isArray(d) ? d : []); }
    catch { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markAllRead = async () => {
    const unreadIds = items.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    try { await api.post('/notifications/mark-read', { ids: unreadIds }); toast({ title: t('notifications.allMarkedRead') }); fetchData(); }
    catch { toast({ title: t('notifications.failedToMark'), variant: 'destructive' }); }
  };

  const markRead = async (id: number) => {
    try { await api.post('/notifications/mark-read', { ids: [id] }); setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)); } catch {}
  };

  const unreadCount = items.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('notifications.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('notifications.unreadCount', { count: unreadCount })}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
            <CheckCheck className="h-4 w-4" /> {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BellOff className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">{t('notifications.noNotifications')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className={`transition-colors ${!n.read ? 'border-primary/30 bg-primary/5' : ''}`} onClick={() => !n.read && markRead(n.id)}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${!n.read ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.read ? 'font-semibold text-foreground' : 'text-foreground'}`}>{n.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
