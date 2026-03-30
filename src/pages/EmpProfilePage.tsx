import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Loader2, Save, ShieldCheck, ShieldOff, Smartphone, Copy, CheckCircle2, MapPin, Send, Info } from 'lucide-react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/translateError';

export default function EmpProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState({ fullName: user?.fullName || '', email: user?.email || '', phone: user?.phone || '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  // 2FA state
  const [f2aEnabled, setF2aEnabled] = useState(user?.f2a_enabled || false);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'disabling'>('idle');
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [f2aLoading, setF2aLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Location change request state
  const [locName, setLocName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locReason, setLocReason] = useState('');
  const [locSubmitting, setLocSubmitting] = useState(false);

  const saveProfile = async () => {
    if (!profile.fullName.trim() || !profile.email.trim()) { toast({ title: t('empProfile.nameEmailRequired'), variant: 'destructive' }); return; }
    setProfileSaving(true);
    try {
      await api.patch('/users/me', { full_name: profile.fullName.trim(), email: profile.email.trim(), phone: profile.phone.trim() || undefined });
      toast({ title: t('empProfile.profileUpdated') });
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err, 'empProfile.failedToUpdate'), variant: 'destructive' }); }
    finally { setProfileSaving(false); }
  };

  const changePassword = async () => {
    if (!passwords.current || !passwords.newPassword) { toast({ title: t('empProfile.allPasswordFieldsRequired'), variant: 'destructive' }); return; }
    if (passwords.newPassword !== passwords.confirm) { toast({ title: t('empProfile.passwordsNotMatch'), variant: 'destructive' }); return; }
    if (passwords.newPassword.length < 8) { toast({ title: t('empProfile.passwordMinChars'), variant: 'destructive' }); return; }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: passwords.current, newPassword: passwords.newPassword, confirmPassword: passwords.confirm });
      toast({ title: t('empProfile.passwordChanged') });
      setPasswords({ current: '', newPassword: '', confirm: '' });
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err, 'empProfile.failedToChangePassword'), variant: 'destructive' }); }
    finally { setPwSaving(false); }
  };

  const startSetup2fa = async () => {
    setF2aLoading(true);
    try {
      const res = await api.post('/auth/2fa/setup');
      const d = res.data?.data ?? res.data;
      setSetupData(d);
      setSetupStep('qr');
      setVerifyCode('');
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setF2aLoading(false); }
  };

  const verifyAndEnable2fa = async () => {
    if (verifyCode.length !== 6) { toast({ title: t('empProfile.enter6Digits'), variant: 'destructive' }); return; }
    setF2aLoading(true);
    try {
      await api.post('/auth/2fa/verify-setup', { code: verifyCode });
      setF2aEnabled(true);
      setSetupStep('idle');
      setSetupData(null);
      setVerifyCode('');
      toast({ title: t('empProfile.f2aEnabled') });
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setF2aLoading(false); }
  };

  const disable2fa = async () => {
    if (verifyCode.length !== 6) { toast({ title: t('empProfile.enter6Digits'), variant: 'destructive' }); return; }
    setF2aLoading(true);
    try {
      await api.post('/auth/2fa/disable', { code: verifyCode });
      setF2aEnabled(false);
      setSetupStep('idle');
      setVerifyCode('');
      toast({ title: t('empProfile.f2aDisabled') });
    } catch (err: any) { toast({ title: t('common.error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
    finally { setF2aLoading(false); }
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('empProfile.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('empProfile.subtitle')}</p>
      </div>

      {/* Personal Info */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4 text-primary" /> {t('empProfile.personalInfo')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {user?.emp_no && (
            <div>
              <Label className="text-muted-foreground">{t('empProfile.employeeNo')}</Label>
              <Input value={user.emp_no} disabled className="bg-muted/50" />
              <p className="mt-1 text-xs text-muted-foreground">{t('empProfile.empNoCannotChange')}</p>
            </div>
          )}
          <div><Label>{t('empProfile.fullName')} *</Label><Input value={profile.fullName} onChange={(e) => setProfile(p => ({ ...p, fullName: e.target.value }))} /></div>
          <div><Label>{t('common.email')} *</Label><Input type="email" value={profile.email} onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))} /></div>
          <div>
            <Label>{t('common.phone')}</Label>
            <Input value={profile.phone} onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+94 7X XXX XXXX" />
            <p className="mt-1 text-xs text-muted-foreground">{t('empProfile.phoneHint')}</p>
          </div>
          <Button onClick={saveProfile} disabled={profileSaving} className="gap-1.5">
            {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('empProfile.saveChanges')}
          </Button>
        </CardContent>
      </Card>

      {/* 2FA Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> {t('empProfile.twoFactorAuth')}
          </CardTitle>
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
              <Badge variant="outline" className="gap-1 border-green-300 text-green-700 bg-green-50">
                <CheckCircle2 className="h-3 w-3" /> {t('empProfile.enabled')}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-muted text-muted-foreground">
                <ShieldOff className="h-3 w-3" /> {t('empProfile.disabled')}
              </Badge>
            )}
          </div>

          {/* Setup QR step */}
          {setupStep === 'qr' && setupData && (
            <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
              <p className="text-sm font-medium text-foreground">{t('empProfile.scanQrCode')}</p>
              <p className="text-xs text-muted-foreground">{t('empProfile.scanQrDesc')}</p>
              <div className="flex justify-center p-4 bg-background rounded-lg">
                <QRCodeSVG value={setupData.otpauthUrl} size={200} />
              </div>
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
              <p className="text-sm font-medium text-foreground">{t('empProfile.enterVerifyCode')}</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setSetupStep('idle'); setSetupData(null); setVerifyCode(''); }}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={verifyAndEnable2fa} disabled={f2aLoading || verifyCode.length !== 6} className="gap-1.5">
                  {f2aLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {t('empProfile.enableF2a')}
                </Button>
              </div>
            </div>
          )}

          {/* Disable step */}
          {setupStep === 'disabling' && (
            <div className="space-y-4 rounded-lg border border-destructive/30 p-4 bg-destructive/5">
              <p className="text-sm font-medium text-foreground">{t('empProfile.disableF2aTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('empProfile.disableF2aDesc')}</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setSetupStep('idle'); setVerifyCode(''); }}>
                  {t('common.cancel')}
                </Button>
                <Button variant="destructive" onClick={disable2fa} disabled={f2aLoading || verifyCode.length !== 6} className="gap-1.5">
                  {f2aLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                  {t('empProfile.disableF2a')}
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons when idle */}
          {setupStep === 'idle' && (
            f2aEnabled ? (
              <Button variant="outline" onClick={() => { setSetupStep('disabling'); setVerifyCode(''); }} className="gap-1.5">
                <ShieldOff className="h-4 w-4" /> {t('empProfile.disableF2a')}
              </Button>
            ) : (
              <Button onClick={startSetup2fa} disabled={f2aLoading} className="gap-1.5">
                {f2aLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {t('empProfile.setupF2a')}
              </Button>
            )
          )}
        </CardContent>
      </Card>

      {/* Location Change Request */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" /> {t('empProfile.locationChangeRequest', 'Request Location Change')}
          </CardTitle>
          <CardDescription>{t('empProfile.locationChangeDesc', 'Submit a request to change your pickup/drop-off location. Admin will review and approve.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-primary/30 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs text-foreground/80">
              {t('empProfile.locationChangeNote', 'Enter a unique location name (e.g. your Employee ID) along with coordinates. Your request will be sent to admin for approval.')}
            </AlertDescription>
          </Alert>
          <div>
            <Label>{t('empSelfService.locationName', 'Location Name')} *</Label>
            <Input value={locName} onChange={e => setLocName(e.target.value)} placeholder={t('empSelfService.locationNamePlaceholder', 'e.g. EMP001-Home')} maxLength={255} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('empSelfService.latitude', 'Latitude')} *</Label>
              <Input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="e.g. 6.9271" />
            </div>
            <div>
              <Label>{t('empSelfService.longitude', 'Longitude')} *</Label>
              <Input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="e.g. 79.8612" />
            </div>
          </div>
          <div>
            <Label>{t('empSelfService.reason', 'Reason')}</Label>
            <Textarea value={locReason} onChange={e => setLocReason(e.target.value)} placeholder={t('empSelfService.reasonPlaceholder', 'Why do you need to change your location?')} rows={3} maxLength={500} />
          </div>
          <Button
            onClick={async () => {
              const name = locName.trim();
              if (!name) { toast({ title: t('empSelfService.nameRequired', 'Location name is required'), variant: 'destructive' }); return; }
              if (!lat || !lng) { toast({ title: t('empSelfService.coordsRequired', 'Coordinates are required'), variant: 'destructive' }); return; }
              setLocSubmitting(true);
              try {
                await api.post('/self-service/location-change', {
                  locationName: name,
                  lat: Number(lat),
                  lng: Number(lng),
                  reason: locReason.trim() || undefined,
                });
                toast({ title: t('empSelfService.destChangeSubmitted', 'Location change request submitted successfully') });
                setLocName(''); setLat(''); setLng(''); setLocReason('');
              } catch (err: any) { toast({ title: t('common.error', 'Error'), description: getApiErrorMessage(err), variant: 'destructive' }); }
              finally { setLocSubmitting(false); }
            }}
            disabled={locSubmitting || !locName.trim() || !lat || !lng}
            className="gap-1.5"
          >
            {locSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('empSelfService.submitRequest', 'Submit Request')}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
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
