import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Bus, Code2, Database, Globe, Layers, Monitor, Server,
  Shield, Sparkles, Heart, Coffee,
} from 'lucide-react';

export default function SystemInfoPage() {
  const { t } = useTranslation();

  const techStack = [
    { labelKey: 'frontend', valueKey: 'frontendValue', icon: Monitor },
    { labelKey: 'uiFramework', valueKey: 'uiFrameworkValue', icon: Layers },
    { labelKey: 'backend', valueKey: 'backendValue', icon: Server },
    { labelKey: 'database', valueKey: 'databaseValue', icon: Database },
    { labelKey: 'authentication', valueKey: 'authenticationValue', icon: Shield },
    { labelKey: 'internationalization', valueKey: 'internationalizationValue', icon: Globe },
  ];

  const moduleKeys = [
    'moduleEmployeeMgmt', 'moduleTransportWorkflow', 'moduleRouteGrouping',
    'moduleVehicleDriver', 'moduleApproval', 'moduleDepartment',
    'moduleNotifications', 'moduleReporting', 'moduleAudit',
    'moduleAnalytics', 'moduleSelfService', 'moduleBulkImport',
  ];

  const roles = [
    { roleKey: 'roleSuperAdmin', code: 'SUPER_ADMIN', descKey: 'roleSuperAdminDesc' },
    { roleKey: 'roleAdmin', code: 'ADMIN', descKey: 'roleAdminDesc' },
    { roleKey: 'roleHod', code: 'HOD', descKey: 'roleHodDesc' },
    { roleKey: 'roleHr', code: 'HR', descKey: 'roleHrDesc' },
    { roleKey: 'roleTa', code: 'TRANSPORT_AUTHORITY', descKey: 'roleTaDesc' },
    { roleKey: 'rolePlanning', code: 'PLANNING', descKey: 'rolePlanningDesc' },
    { roleKey: 'roleEmployee', code: 'EMP', descKey: 'roleEmployeeDesc' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('systemInfo.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('systemInfo.subtitle')}</p>
      </div>

      <Card className="overflow-hidden">
        <div className="relative p-6" style={{ background: 'var(--gradient-primary)' }}>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Bus className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t('systemInfo.systemName')}</h2>
              <p className="text-white/80 text-sm mt-0.5">{t('systemInfo.systemDesc')}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">{t('systemInfo.version')}</Badge>
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">{t('systemInfo.production')}</Badge>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            {t('systemInfo.techStack')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {techStack.map((tech, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <div className="p-2 rounded-md bg-primary/10">
                  <tech.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t(`systemInfo.${tech.labelKey}`)}</p>
                  <p className="text-sm font-medium text-foreground">{t(`systemInfo.${tech.valueKey}`)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t('systemInfo.systemModules')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {moduleKeys.map((key, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-foreground">{t(`systemInfo.${key}`)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            {t('systemInfo.userRoles')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {roles.map((r, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Badge variant="outline" className="text-[10px] font-mono shrink-0 mt-0.5">{r.code}</Badge>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(`systemInfo.${r.roleKey}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`systemInfo.${r.descKey}`)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/20 border-dashed">
        <CardContent className="p-6">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <span className="text-xs">{t('systemInfo.craftedWith')}</span>
              <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
              <span className="text-xs">{t('systemInfo.and')}</span>
              <Coffee className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <Separator className="max-w-xs mx-auto" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t('systemInfo.developerName')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('systemInfo.developerUnit')}</p>
            </div>
            <p className="text-[11px] text-muted-foreground/60 max-w-md mx-auto">{t('systemInfo.tagline')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
