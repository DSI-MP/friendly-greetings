import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Save, Loader2, Mail, MessageSquare, Phone, Send, CheckCircle2, XCircle, KeyRound, ShieldCheck, ShieldOff, Bus, Smartphone, Lock, Copy } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/translateError';
import type { SystemSetting } from '@/types/entities';

interface ChannelStatus { enabled: boolean; provider: string; configured: boolean; label?: string; }
interface ChannelsResponse { emailPasswordReset?: ChannelStatus; emailNotification?: ChannelStatus; emailTransport?: ChannelStatus; sms?: ChannelStatus; whatsapp?: ChannelStatus; }

export default function SettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<ChannelsResponse>({});
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // 2FA state
  const [f2aEnabled, setF2aEnabled] = useState(user?.f2a_enabled || false);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'disabling'>('idle');
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [f2aLoading, setF2aLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  // Password state
  const [passwords, setPasswords] = useState({ current: '', newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    (async () => { setLoading(true); try { const res = await api.get('/settings'); const d = res.data?.data ?? res.data; setSettings(Array.isArray(d) ? d : []); } catch { setSettings([]); } finally { setLoading(false); } })();
    (async () => { setChannelsLoading(true); try { const res = await api.get('/channels/status'); setChannels(res.data?.data ?? res.data ?? {}); } catch { setChannels({}); } finally { setChannelsLoading(false); } })();
  }, []);

  const handleSave = async () => {
    const changes = Object.entries(edits).map(([key, value]) => ({ key, value }));
    if (changes.length === 0) { toast({ title: t('settings.noChanges') }); return; }
    setSaving(true);
    try { await api.patch('/settings', changes); toast({ title: t('settings.settingsSaved') }); setEdits({}); const res = await api.get('/settings'); setSettings(res.data?.data ?? res.data ?? []); }
    catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err, 'settings.failedToSave'), variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleTestEmail = async () => {
    if (!testEmail) { toast({ title: t('settings.enterEmail') }); return; }
    setTestingEmail(true);
    try { const res = await api.post('/channels/test-email', { to: testEmail }); const d = res.data?.data ?? res.data; toast({ title: d.success ? t('settings.testEmailSent') : t('settings.failedToSendTest'), description: d.message }); }
    catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setTestingEmail(false); }
  };

  const startSetup2fa = async () => {
    setF2aLoading(true);
    try { const res = await api.post('/auth/2fa/setup'); const d = res.data?.data ?? res.data; setSetupData(d); setSetupStep('qr'); setVerifyCode(''); }
    catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setF2aLoading(false); }
  };
  const verifyAndEnable2fa = async () => {
    if (verifyCode.length !== 6) { toast({ title: t('empProfile.enter6Digits'), variant: 'destructive' }); return; }
    setF2aLoading(true);
    try { await api.post('/auth/2fa/verify-setup', { code: verifyCode }); setF2aEnabled(true); setSetupStep('idle'); setSetupData(null); setVerifyCode(''); toast({ title: t('empProfile.f2aEnabled') }); }
    catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setF2aLoading(false); }
  };
  const disable2fa = async () => {
    if (verifyCode.length !== 6) { toast({ title: t('empProfile.enter6Digits'), variant: 'destructive' }); return; }
    setF2aLoading(true);
    try { await api.post('/auth/2fa/disable', { code: verifyCode }); setF2aEnabled(false); setSetupStep('idle'); setVerifyCode(''); toast({ title: t('empProfile.f2aDisabled') }); }
    catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setF2aLoading(false); }
  };
  const copySecret = () => { if (setupData?.secret) { navigator.clipboard.writeText(setupData.secret); setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  const changePassword = async () => {
    if (!passwords.current || !passwords.newPassword) { toast({ title: t('empProfile.allPasswordFieldsRequired'), variant: 'destructive' }); return; }
    if (passwords.newPassword !== passwords.confirm) { toast({ title: t('empProfile.passwordsNotMatch'), variant: 'destructive' }); return; }
    if (passwords.newPassword.length < 8) { toast({ title: t('empProfile.passwordMinChars'), variant: 'destructive' }); return; }
    setPwSaving(true);
    try { await api.post('/auth/change-password', { currentPassword: passwords.current, newPassword: passwords.newPassword, confirmPassword: passwords.confirm }); toast({ title: t('empProfile.passwordChanged') }); setPasswords({ current: '', newPassword: '', confirm: '' }); }
    catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err, 'empProfile.failedToChangePassword'), variant: 'destructive' }); }
    finally { setPwSaving(false); }
  };

  const getValue = (key: string) => edits[key] ?? settings.find(s => s.key === key)?.value ?? '';
  const updateValue = (key: string, value: string) => setEdits(prev => ({ ...prev, [key]: value }));

  const categories = settings.reduce<Record<string, SystemSetting[]>>((acc, s) => { const cat = s.category || 'General'; (acc[cat] = acc[cat] || []).push(s); return acc; }, {});

  const ChannelCard = ({ icon: Icon, title, channel, color }: { icon: any; title: string; channel?: ChannelStatus; color: string }) => (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${color} bg-opacity-10`}><Icon className="h-5 w-5 text-foreground" /></div>
            <div><p className="font-semibold text-sm text-foreground">{title}</p><p className="text-xs text-muted-foreground">{channel?.provider || t('settings.notConfigured')}</p></div>
          </div>
          <div className="flex items-center gap-2">
            {channel?.configured ? (
              <Badge variant="outline" className="gap-1 text-xs border-green-300 text-green-700 bg-green-50"><CheckCircle2 className="h-3 w-3" /> {t('settings.configured')}</Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-xs border-muted text-muted-foreground"><XCircle className="h-3 w-3" /> {t('settings.notSet')}</Badge>
            )}
            <div className="flex items-center gap-1.5">
              <Switch checked={channel?.enabled || false} disabled className="scale-90" />
              <span className="text-xs text-muted-foreground">{channel?.enabled ? t('common.active') : t('common.inactive')}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const anyEmailConfigured = channels.emailPasswordReset?.configured || channels.emailNotification?.configured || channels.emailTransport?.configured;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
        </div>
        <Button onClick={handleSave} disabled={saving || Object.keys(edits).length === 0} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('settings.saveChanges')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> {t('settings.brevoApiKeys')}</CardTitle>
          <CardDescription>{t('settings.brevoDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {channelsLoading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div> : (
            <>
              <ChannelCard icon={ShieldCheck} title={t('settings.passwordResetEmail')} channel={channels.emailPasswordReset} color="bg-primary" />
              <ChannelCard icon={Mail} title={t('settings.notificationEmail')} channel={channels.emailNotification} color="bg-primary" />
              <ChannelCard icon={Bus} title={t('settings.transportDetailsEmail')} channel={channels.emailTransport} color="bg-primary" />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> {t('settings.smsWhatsapp')}</CardTitle>
          <CardDescription>{t('settings.smsWhatsappDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {channelsLoading ? <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div> : (
            <>
              <ChannelCard icon={Phone} title={t('settings.sms')} channel={channels.sms} color="bg-muted" />
              <ChannelCard icon={MessageSquare} title={t('settings.whatsapp')} channel={channels.whatsapp} color="bg-muted" />
            </>
          )}
        </CardContent>
      </Card>

      {anyEmailConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> {t('settings.sendTestEmail')}</CardTitle>
            <CardDescription>{t('settings.verifyBrevo')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input placeholder="recipient@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="max-w-sm" />
              <Button onClick={handleTestEmail} disabled={testingEmail} variant="outline" className="gap-1.5">
                {testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t('settings.sendTest')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}</div>
      ) : settings.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">{t('settings.noSettings')}</CardContent></Card>
      ) : (
        Object.entries(categories).map(([cat, items]) => (
          <Card key={cat}>
            <CardHeader><CardTitle className="text-base">{cat}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {items.map((s) => (
                <div key={s.key} className="grid gap-1">
                  <Label className="text-sm font-medium">{s.key}</Label>
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  <Input value={getValue(s.key)} onChange={(e) => updateValue(s.key, e.target.value)} className={edits[s.key] !== undefined ? 'border-primary' : ''} />
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {/* ── Account Security: 2FA ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> {t('empProfile.twoFactorAuth')}</CardTitle>
          <CardDescription>{t('empProfile.twoFactorDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{t('empProfile.authenticatorApp')}</p>
                <p className="text-xs text-muted-foreground">{t('empProfile.authenticatorDesc')}</p>
              </div>
            </div>
            {f2aEnabled ? (
              <Badge variant="outline" className="gap-1 border-green-300 text-green-700 bg-green-50"><CheckCircle2 className="h-3 w-3" /> {t('empProfile.enabled')}</Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-muted text-muted-foreground"><ShieldOff className="h-3 w-3" /> {t('empProfile.disabled')}</Badge>
            )}
          </div>

          {setupStep === 'qr' && setupData && (
            <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
              <p className="text-sm font-medium text-foreground">{t('empProfile.scanQrCode')}</p>
              <div className="flex justify-center p-4 bg-background rounded-lg"><QRCodeSVG value={setupData.otpauthUrl} size={200} /></div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('empProfile.cantScanQr')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">{setupData.secret}</code>
                  <Button variant="outline" size="sm" onClick={copySecret} className="gap-1 shrink-0">
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? t('common.copied') : t('common.copy')}
                  </Button>
                </div>
              </div>
              <Separator />
              <p className="text-sm font-medium">{t('empProfile.enterVerifyCode')}</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
                  <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setSetupStep('idle'); setSetupData(null); setVerifyCode(''); }}>{t('common.cancel')}</Button>
                <Button onClick={verifyAndEnable2fa} disabled={f2aLoading || verifyCode.length !== 6} className="gap-1.5">
                  {f2aLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {t('empProfile.enableF2a')}
                </Button>
              </div>
            </div>
          )}

          {setupStep === 'disabling' && (
            <div className="space-y-4 rounded-lg border border-destructive/30 p-4 bg-destructive/5">
              <p className="text-sm font-medium">{t('empProfile.disableF2aTitle')}</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
                  <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setSetupStep('idle'); setVerifyCode(''); }}>{t('common.cancel')}</Button>
                <Button variant="destructive" onClick={disable2fa} disabled={f2aLoading || verifyCode.length !== 6} className="gap-1.5">
                  {f2aLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />} {t('empProfile.disableF2a')}
                </Button>
              </div>
            </div>
          )}

          {setupStep === 'idle' && (
            f2aEnabled ? (
              <Button variant="outline" onClick={() => { setSetupStep('disabling'); setVerifyCode(''); }} className="gap-1.5"><ShieldOff className="h-4 w-4" /> {t('empProfile.disableF2a')}</Button>
            ) : (
              <Button onClick={startSetup2fa} disabled={f2aLoading} className="gap-1.5">
                {f2aLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {t('empProfile.setupF2a')}
              </Button>
            )
          )}
        </CardContent>
      </Card>

      {/* ── Change Password ── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4 text-primary" /> {t('empProfile.changePassword')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>{t('empProfile.currentPassword')} *</Label><Input type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))} /></div>
          <Separator />
          <div><Label>{t('empProfile.newPassword')} *</Label><Input type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords(p => ({ ...p, newPassword: e.target.value }))} /></div>
          <div><Label>{t('empProfile.confirmNewPassword')} *</Label><Input type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))} /></div>
          <Button onClick={changePassword} disabled={pwSaving} variant="outline" className="gap-1.5">
            {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {t('empProfile.changePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
