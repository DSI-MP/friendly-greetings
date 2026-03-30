import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, Bus, Shield, Clock, Users } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showBackToLogin?: boolean;
}

const features = [
  { icon: Bus, labelKey: 'auth.featureRoutes' as const, fallback: 'Smart route optimization' },
  { icon: Shield, labelKey: 'auth.featureSecurity' as const, fallback: 'Enterprise-grade security' },
  { icon: Clock, labelKey: 'auth.featureRealtime' as const, fallback: 'Real-time tracking' },
  { icon: Users, labelKey: 'auth.featureMultiRole' as const, fallback: 'Multi-role access control' },
];

export default function AuthLayout({ children, title, subtitle, showBackToLogin = false }: AuthLayoutProps) {
  const { dark, toggle } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="auth-page-bg flex min-h-screen">
      {/* Left branded panel - hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative overflow-hidden">
        <div className="absolute inset-0 welcome-banner rounded-none">
          <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Bus size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">{t('common.appName')}</h2>
                  <p className="text-[11px] font-medium text-white/60 uppercase tracking-widest">{t('common.brandSub')}</p>
                </div>
              </div>
            </div>

            {/* Hero text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight">
                {t('auth.heroTitle1')}<br />{t('auth.heroTitle2')}
              </h1>
              <p className="text-sm text-white/70 max-w-md leading-relaxed">
                {t('auth.heroDesc')}
              </p>

              {/* Feature pills */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {features.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-2.5 rounded-xl bg-white/10 backdrop-blur-sm px-3.5 py-2.5"
                  >
                    <f.icon size={16} className="text-white/80 shrink-0" />
                    <span className="text-xs font-medium text-white/90">{f.fallback}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Footer */}
            <p className="text-[11px] text-white/40">
              {t('common.copyright', { year: new Date().getFullYear() })}
            </p>
          </div>

          {/* Decorative shapes */}
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/5" />
          <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />
          <div className="absolute right-10 bottom-32 h-40 w-40 rounded-full bg-white/[0.03]" />
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 relative">
        {/* Top-right controls */}
        <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
          <LanguageSwitcher />
          <button
            onClick={toggle}
            className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground transition-all duration-200 hover:text-foreground hover:shadow-sm"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile brand */}
          <div className="mb-8 text-center lg:mb-10">
            <div className="lg:hidden mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg" style={{ background: 'var(--gradient-primary)' }}>
              <Bus size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-left">{t('common.appName')}</h1>
            <p className="mt-1 text-xs font-semibold tracking-widest uppercase gradient-text lg:text-left">{title}</p>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground lg:text-left">{subtitle}</p>
            )}
          </div>

          {/* Card */}
          <div className="auth-card">{children}</div>

          {/* Back to login */}
          {showBackToLogin && (
            <div className="mt-6 text-center lg:text-left">
              <Link to="/login" className="auth-link">{t('auth.backToSignIn')}</Link>
            </div>
          )}

          {/* Footer (mobile only) */}
          <p className="mt-8 text-center text-[11px] text-muted-foreground lg:hidden">
            {t('common.copyright', { year: new Date().getFullYear() })}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
