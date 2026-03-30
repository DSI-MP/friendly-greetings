import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Lock, KeyRound, Eye, Database, RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DataProtectionPage() {
  const { t } = useTranslation();

  const protectionMeasures = [
    { icon: Lock, titleKey: 'encryptionTitle', descKey: 'encryptionDesc' },
    { icon: KeyRound, titleKey: 'authAccessTitle', descKey: 'authAccessDesc' },
    { icon: Eye, titleKey: 'auditTitle', descKey: 'auditDesc' },
    { icon: ShieldCheck, titleKey: 'twoFactorTitle', descKey: 'twoFactorDesc' },
    { icon: Database, titleKey: 'dataSegTitle', descKey: 'dataSegDesc' },
    { icon: RefreshCcw, titleKey: 'sessionTitle', descKey: 'sessionDesc' },
  ];

  const complianceItems = [
    { labelKey: 'passwordPolicy', detailKey: 'passwordPolicyDetail' },
    { labelKey: 'roleBasedAccess', detailKey: 'roleBasedAccessDetail' },
    { labelKey: 'auditLogging', detailKey: 'auditLoggingDetail' },
    { labelKey: 'dataEncryption', detailKey: 'dataEncryptionDetail' },
    { labelKey: 'inputValidation', detailKey: 'inputValidationDetail' },
    { labelKey: 'rateLimiting', detailKey: 'rateLimitingDetail' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dataProtection.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('dataProtection.subtitle')}</p>
      </div>

      <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
        <CardContent className="p-5 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
            <ShieldCheck className="h-5 w-5 text-green-700 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">{t('dataProtection.allSystemsActive')}</p>
            <p className="text-xs text-green-700/80 dark:text-green-400/70 mt-0.5">{t('dataProtection.allSystemsActiveDesc')}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {protectionMeasures.map((measure, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <measure.icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  {t(`dataProtection.${measure.titleKey}`)}
                </CardTitle>
                <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-950/30">
                  {t('dataProtection.active')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">{t(`dataProtection.${measure.descKey}`)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {t('dataProtection.complianceChecklist')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {complianceItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t(`dataProtection.${item.labelKey}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`dataProtection.${item.detailKey}`)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">{t('dataProtection.reportConcern')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('dataProtection.reportConcernDesc')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
