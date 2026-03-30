import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Eye, Lock, FileText, Users, Server } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const { t } = useTranslation();

  const sections = [
    { icon: Eye, titleKey: 'infoCollectTitle', contentKey: 'infoCollectContent' },
    { icon: FileText, titleKey: 'howWeUseTitle', contentKey: 'howWeUseContent' },
    { icon: Users, titleKey: 'dataSharingTitle', contentKey: 'dataSharingContent' },
    { icon: Lock, titleKey: 'retentionTitle', contentKey: 'retentionContent' },
    { icon: Server, titleKey: 'securityTitle', contentKey: 'securityContent' },
    { icon: Shield, titleKey: 'rightsTitle', contentKey: 'rightsContent' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('privacyPolicy.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('privacyPolicy.subtitle')}</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <p className="text-sm text-foreground leading-relaxed">{t('privacyPolicy.intro')}</p>
          <p className="text-xs text-muted-foreground mt-2">{t('privacyPolicy.lastUpdated')}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {sections.map((section, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                {t(`privacyPolicy.${section.titleKey}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {t(`privacyPolicy.${section.contentKey}`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-5 text-center">
          <p className="text-xs text-muted-foreground">{t('privacyPolicy.contactNote')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
