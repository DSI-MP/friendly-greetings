import { useState, type FormEvent } from 'react';
import { Loader2, CheckCircle, ArrowRight, Mail, Hash } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthLayout from '@/components/auth/AuthLayout';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/translateError';

type Step = 'identify' | 'otp' | 'reset' | 'done';
type Method = 'email' | 'empno';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('identify');
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [empNo, setEmpNo] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCountdown(300);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleRequestByEmail = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!email.trim()) { setErrors({ email: t('auth.emailRequired') }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrors({ email: t('auth.emailInvalid') }); return; }
    setSubmitting(true);
    try {
      await api.post('/auth/request-password-reset', { email: email.trim() });
      setStep('otp');
      startCountdown();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'forgotPassword.failedToSend');
      toast({ variant: 'destructive', title: t('forgotPassword.error'), description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestByEmpNo = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!empNo.trim()) { setErrors({ empNo: t('forgotPassword.empNoRequired') }); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/auth/request-password-reset-by-empno', { empNo: empNo.trim() });
      const d = res.data?.data ?? res.data;
      // Always set email from response (required for OTP verify step)
      if (d.email) {
        setEmail(d.email);
      }
      if (d.maskedEmail) {
        setMaskedEmail(d.maskedEmail);
      }
      if (!d.email) {
        toast({ variant: 'destructive', title: t('forgotPassword.error'), description: 'Could not retrieve email for this employee. Please use email method instead.' });
        return;
      }
      setStep('otp');
      startCountdown();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'forgotPassword.failedToSend');
      toast({ variant: 'destructive', title: t('forgotPassword.error'), description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!otp.trim() || otp.length !== 6) { setErrors({ otp: t('forgotPassword.enterCode') }); return; }
    setSubmitting(true);
    try {
      await api.post('/auth/verify-otp', { email: email.trim(), otp: otp.trim() });
      setStep('reset');
      setErrors({});
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'forgotPassword.invalidCode');
      toast({ variant: 'destructive', title: t('forgotPassword.verificationFailed'), description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (ev: FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!newPassword) e.newPassword = t('forgotPassword.passwordRequired');
    else if (newPassword.length < 6) e.newPassword = t('forgotPassword.passwordMin');
    if (newPassword !== confirmPassword) e.confirmPassword = t('forgotPassword.passwordsNotMatch');
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { email: email.trim(), otp: otp.trim(), newPassword, confirmPassword });
      setStep('done');
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'forgotPassword.resetFailed');
      toast({ variant: 'destructive', title: t('forgotPassword.error'), description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (step === 'done') {
    return (
      <AuthLayout title={t('forgotPassword.passwordReset')} showBackToLogin>
        <div className="flex flex-col items-center gap-4 py-4 text-center animate-slide-up">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle size={32} className="text-success" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t('forgotPassword.passwordChanged')}</h2>
          <p className="text-sm text-muted-foreground">{t('forgotPassword.passwordChangedDesc')}</p>
        </div>
      </AuthLayout>
    );
  }

  const otpSubtitle = method === 'empno' && maskedEmail
    ? t('forgotPassword.codeSentToMasked', { maskedEmail })
    : t('forgotPassword.codeSentTo', { email });

  return (
    <AuthLayout
      title={step === 'identify' ? t('forgotPassword.title') : step === 'otp' ? t('forgotPassword.verifyCode') : t('forgotPassword.setNewPassword')}
      subtitle={
        step === 'identify'
          ? t('forgotPassword.subtitle')
          : step === 'otp'
          ? otpSubtitle
          : t('forgotPassword.chooseStrongPassword')
      }
      showBackToLogin
    >
      {step === 'identify' && (
        <div className="space-y-5">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => { setMethod('email'); setErrors({}); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                method === 'email'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Mail size={16} /> {t('forgotPassword.emailTab')}
            </button>
            <button
              type="button"
              onClick={() => { setMethod('empno'); setErrors({}); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                method === 'empno'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Hash size={16} /> {t('forgotPassword.empNoTab')}
            </button>
          </div>

          {method === 'email' ? (
            <form onSubmit={handleRequestByEmail} className="space-y-5">
              <div>
                <label className="auth-label">{t('auth.email')}</label>
                <input
                  className={`auth-input ${errors.email ? 'border-destructive' : ''}`}
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>
              <button type="submit" disabled={submitting} className="btn-auth-primary">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {submitting ? t('forgotPassword.sending') : t('forgotPassword.sendCode')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequestByEmpNo} className="space-y-5">
              <div>
                <label className="auth-label">{t('forgotPassword.employeeNumber')}</label>
                <input
                  className={`auth-input ${errors.empNo ? 'border-destructive' : ''}`}
                  type="text"
                  placeholder={t('forgotPassword.empNoPlaceholder')}
                  value={empNo}
                  onChange={(e) => { setEmpNo(e.target.value); setErrors({}); }}
                />
                {errors.empNo && <p className="mt-1 text-xs text-destructive">{errors.empNo}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{t('forgotPassword.empNoHint')}</p>
              </div>
              <button type="submit" disabled={submitting} className="btn-auth-primary">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {submitting ? t('forgotPassword.sending') : t('forgotPassword.sendCode')}
              </button>
            </form>
          )}
        </div>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          {method === 'empno' && maskedEmail && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
              <p className="text-sm text-foreground">
                📧 {t('forgotPassword.checkInbox')} <span className="font-semibold text-primary">{maskedEmail}</span>
              </p>
            </div>
          )}
          <div>
            <label className="auth-label">{t('forgotPassword.sixDigitCode')}</label>
            <input
              className={`auth-input text-center text-lg tracking-[0.5em] font-mono ${errors.otp ? 'border-destructive' : ''}`}
              type="text"
              maxLength={6}
              placeholder={t('forgotPassword.codePlaceholder')}
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrors({}); }}
              autoFocus
            />
            {errors.otp && <p className="mt-1 text-xs text-destructive">{errors.otp}</p>}
          </div>
          {countdown > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              {t('forgotPassword.codeExpires')} <span className="font-medium text-foreground">{formatTime(countdown)}</span>
            </p>
          )}
          {countdown === 0 && step === 'otp' && (
            <p className="text-center text-xs text-destructive font-medium">{t('forgotPassword.codeExpired')}</p>
          )}
          <button type="submit" disabled={submitting || countdown === 0} className="btn-auth-primary">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {submitting ? t('forgotPassword.verifying') : t('forgotPassword.verify')}
          </button>
          <button type="button" onClick={() => { setStep('identify'); setOtp(''); setCountdown(0); setMaskedEmail(''); }} className="btn-auth-secondary w-full">
            {t('forgotPassword.backToReset')}
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleResetPassword} className="space-y-5">
          <div>
            <label className="auth-label">{t('forgotPassword.newPassword')}</label>
            <div className="relative">
              <input className={`auth-input pr-10 ${errors.newPassword ? 'border-destructive' : ''}`} type={showPw ? 'text' : 'password'} placeholder={t('forgotPassword.minChars')} value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setErrors((p) => { const n = { ...p }; delete n.newPassword; return n; }); }} />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.newPassword && <p className="mt-1 text-xs text-destructive">{errors.newPassword}</p>}
          </div>
          <div>
            <label className="auth-label">{t('forgotPassword.confirmPassword')}</label>
            <div className="relative">
              <input className={`auth-input pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`} type={showCpw ? 'text' : 'password'} placeholder={t('forgotPassword.reenterPassword')} value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => { const n = { ...p }; delete n.confirmPassword; return n; }); }} />
              <button type="button" onClick={() => setShowCpw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showCpw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1 text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>
          <button type="submit" disabled={submitting} className="btn-auth-primary">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {submitting ? t('forgotPassword.resetting') : t('forgotPassword.resetPassword')}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
