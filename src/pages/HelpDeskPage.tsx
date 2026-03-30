import { useTranslation } from 'react-i18next';
import { Mail, Phone, MessageCircle, Clock } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';

export default function HelpDeskPage() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t('helpDesk.title')} subtitle={t('helpDesk.subtitle')} showBackToLogin>
      <div className="space-y-5">
        <InfoRow icon={<Mail size={18} />} label={t('helpDesk.emailSupport')} value="support@transport.company.com" />
        <InfoRow icon={<Phone size={18} />} label={t('helpDesk.phoneSupport')} value="+94 11 234 5678" />
        <InfoRow icon={<MessageCircle size={18} />} label={t('helpDesk.whatsapp')} value="+94 77 123 4567" hint={t('helpDesk.sendAnytime')} />
        <InfoRow icon={<Clock size={18} />} label={t('helpDesk.workingHours')} value={t('helpDesk.workingHoursValue')} hint={t('helpDesk.timezone')} />
      </div>
      <div className="mt-6 rounded-lg bg-accent/60 px-4 py-3 text-xs text-accent-foreground leading-relaxed">
        {t('helpDesk.urgentNote')}
      </div>
    </AuthLayout>
  );
}

function InfoRow({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">{icon}</div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
