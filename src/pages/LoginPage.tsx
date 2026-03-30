import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthLayout from '@/components/auth/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/translateError';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import api from '@/lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // 2FA state
  const [show2fa, setShow2fa] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [verifying2fa, setVerifying2fa] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = t('auth.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t('auth.emailInvalid');
    if (!password) e.password = t('auth.passwordRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/auth/login', { email: email.trim(), password, rememberMe: remember });
      const data = res.data?.data ?? res.data;

      if (data.requires2fa) {
        setTempToken(data.tempToken);
        setShow2fa(true);
        setTwoFaCode('');
        return;
      }

      // Normal login (no 2FA)
      const { token, refreshToken, user } = data;
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem('auth_token', token);
      if (refreshToken) storage.setItem('refresh_token', refreshToken);
      // Force auth context reload
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'apiErrors.invalidCredentials');
      toast({ variant: 'destructive', title: t('auth.signInFailed'), description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handle2faVerify = async () => {
    if (twoFaCode.length !== 6) return;
    setVerifying2fa(true);
    try {
      const res = await api.post('/auth/verify-2fa-login', { email, tempToken, code: twoFaCode });
      const data = res.data?.data ?? res.data;
      const { token, refreshToken } = data;
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem('auth_token', token);
      if (refreshToken) storage.setItem('refresh_token', refreshToken);
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'auth.invalid2faCode');
      toast({ variant: 'destructive', title: t('auth.verificationFailed'), description: msg });
      setTwoFaCode('');
    } finally {
      setVerifying2fa(false);
    }
  };

  // 2FA verification screen
  if (show2fa) {
    return (
      <AuthLayout title={t('auth.twoFactorTitle')} subtitle={t('auth.twoFactorSubtitle')}>
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground">{t('auth.enter2faCode')}</p>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={twoFaCode} onChange={setTwoFaCode} autoFocus>
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
          <button
            type="button"
            onClick={handle2faVerify}
            disabled={verifying2fa || twoFaCode.length !== 6}
            className="btn-auth-primary"
          >
            {verifying2fa ? <Loader2 size={18} className="animate-spin" /> : null}
            {verifying2fa ? t('auth.verifying') : t('auth.verifyCode')}
          </button>
          <button
            type="button"
            onClick={() => { setShow2fa(false); setTempToken(''); setTwoFaCode(''); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on">
        {/* Email */}
        <div>
          <label htmlFor="login-email" className="auth-label">{t('auth.email')}</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            className={`auth-input ${errors.email ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="login-password" className="auth-label">{t('auth.password')}</label>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t('auth.passwordPlaceholder')}
              className={`auth-input pr-10 ${errors.password ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
        </div>

        {/* Remember + Forgot */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            {t('auth.rememberMe')}
          </label>
          <Link to="/forgot-password" className="auth-link text-xs">
            {t('auth.forgotPassword')}
          </Link>
        </div>

        {/* Submit */}
        <button type="submit" disabled={submitting} className="btn-auth-primary">
          {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
          {submitting ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>

      {/* Footer links */}
      <div className="mt-6 flex flex-col items-center gap-2 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          {t('auth.newEmployee')}{' '}
          <Link to="/self-register" className="auth-link">{t('auth.requestAccess')}</Link>
        </p>
        <Link to="/help-desk" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          {t('auth.needHelp')}
        </Link>
      </div>
    </AuthLayout>
  );
}
