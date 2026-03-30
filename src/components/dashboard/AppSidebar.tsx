import {
  LayoutDashboard, FileText, Users, Truck, MapPin, BarChart3,
  Shield, Bell, Settings, HelpCircle, UserCog, Calendar, ClipboardList, CheckSquare, Cog,
  FileBarChart, Bus, FileSpreadsheet, Download, ScrollText, ShieldCheck, Info, Lock,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import type { Role } from '@/types/auth';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';

interface NavItem {
  titleKey: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  labelKey: string;
  items: NavItem[];
}

function getNavSections(role: Role): NavSection[] {
  const common: NavItem[] = [
    { titleKey: 'sidebar.dashboard', url: '/dashboard', icon: LayoutDashboard },
  ];

  /* ── Admin / Super Admin ── */
  const adminOps: NavItem[] = [
    { titleKey: 'sidebar.approvals', url: '/admin/approvals', icon: CheckSquare },
    { titleKey: 'sidebar.dailyLock', url: '/admin/daily-lock', icon: Lock },
    { titleKey: 'sidebar.dropOffRequests', url: '/requests', icon: FileText },
    { titleKey: 'sidebar.locationRequests', url: '/admin/location-requests', icon: MapPin },
    { titleKey: 'sidebar.employees', url: '/employees', icon: Users },
    { titleKey: 'sidebar.departments', url: '/departments', icon: ClipboardList },
    { titleKey: 'sidebar.vehicles', url: '/vehicles', icon: Truck },
    { titleKey: 'sidebar.bulkVehicleUpload', url: '/ta/bulk-vehicle-upload', icon: FileSpreadsheet },
    { titleKey: 'sidebar.places', url: '/places', icon: MapPin },
  ];

  const adminManagement: NavItem[] = [
    { titleKey: 'sidebar.userManagement', url: '/users', icon: Shield },
    { titleKey: 'sidebar.exportEmployees', url: '/admin/export', icon: Download },
    { titleKey: 'sidebar.reports', url: '/reports', icon: FileBarChart },
    { titleKey: 'sidebar.auditLogs', url: '/audit', icon: ClipboardList },
    { titleKey: 'sidebar.analytics', url: '/analytics', icon: BarChart3 },
    { titleKey: 'sidebar.notifications', url: '/notifications', icon: Bell },
    { titleKey: 'sidebar.settings', url: '/settings', icon: Settings },
    { titleKey: 'sidebar.systemInfo', url: '/system-info', icon: Info },
  ];

  /* ── HOD ── */
  const hodItems: NavItem[] = [
    { titleKey: 'sidebar.myRequests', url: '/hod/requests', icon: FileText },
    { titleKey: 'sidebar.createRequest', url: '/requests/create', icon: ClipboardList },
    { titleKey: 'sidebar.bulkUpload', url: '/hod/bulk-upload', icon: FileSpreadsheet },
    { titleKey: 'sidebar.deptEmployees', url: '/employees', icon: Users },
    { titleKey: 'sidebar.reports', url: '/reports', icon: FileBarChart },
  ];

  /* ── HR ── */
  const hrItems: NavItem[] = [
    { titleKey: 'sidebar.finalApprovals', url: '/hr/approvals', icon: CheckSquare },
    { titleKey: 'sidebar.allRequests', url: '/requests', icon: FileText },
    { titleKey: 'sidebar.employees', url: '/employees', icon: Users },
    { titleKey: 'sidebar.exportEmployees', url: '/hr/export', icon: Download },
    { titleKey: 'sidebar.reports', url: '/reports', icon: FileBarChart },
    { titleKey: 'sidebar.analytics', url: '/analytics', icon: BarChart3 },
  ];

  /* ── TA — V2: daily-based, transport-processing only ── */
  const taItems: NavItem[] = [
    { titleKey: 'sidebar.processingQueue', url: '/ta/processing', icon: Cog },
    { titleKey: 'sidebar.allRequests', url: '/requests', icon: FileText },
    { titleKey: 'sidebar.reports', url: '/reports', icon: FileBarChart },
    { titleKey: 'sidebar.vehicles', url: '/vehicles', icon: Truck },
    { titleKey: 'sidebar.bulkVehicleUpload', url: '/ta/bulk-vehicle-upload', icon: FileSpreadsheet },
    { titleKey: 'sidebar.places', url: '/places', icon: MapPin },
  ];

  /* ── Employee ── */
  const empItems: NavItem[] = [
    { titleKey: 'sidebar.myDropOff', url: '/emp/transport', icon: Bus },
    { titleKey: 'sidebar.notifications', url: '/emp/notifications', icon: Bell },
    { titleKey: 'sidebar.selfService', url: '/emp/self-service', icon: Settings },
    { titleKey: 'sidebar.helpDesk', url: '/emp/help-desk', icon: HelpCircle },
    { titleKey: 'sidebar.myProfile', url: '/emp/profile', icon: Users },
  ];

  /* ── Planning ── */
  const planningItems: NavItem[] = [
    { titleKey: 'sidebar.otPlan', url: '/planning/ot-plan', icon: ClipboardList },
    { titleKey: 'sidebar.vehicles', url: '/vehicles', icon: Truck },
    { titleKey: 'sidebar.drivers', url: '/drivers', icon: UserCog },
    { titleKey: 'sidebar.reports', url: '/reports', icon: FileBarChart },
    { titleKey: 'sidebar.analytics', url: '/analytics', icon: BarChart3 },
  ];

  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return [
        { labelKey: 'sidebar.overview', items: common },
        { labelKey: 'sidebar.dropOffOps', items: adminOps },
        { labelKey: 'sidebar.management', items: adminManagement },
      ];
    case 'HOD':
      return [
        { labelKey: 'sidebar.overview', items: common },
        { labelKey: 'sidebar.department', items: hodItems },
      ];
    case 'HR':
      return [
        { labelKey: 'sidebar.overview', items: common },
        { labelKey: 'sidebar.hrOps', items: hrItems },
      ];
    case 'TRANSPORT_AUTHORITY':
      return [
        { labelKey: 'sidebar.overview', items: common },
        { labelKey: 'sidebar.dropOffDispatch', items: taItems },
      ];
    case 'EMP':
      return [
        { labelKey: 'sidebar.overview', items: [{ titleKey: 'sidebar.dashboard', url: '/emp', icon: LayoutDashboard }] },
        { labelKey: 'sidebar.myServices', items: empItems },
      ];
    case 'PLANNING':
      return [
        { labelKey: 'sidebar.overview', items: common },
        { labelKey: 'sidebar.planning', items: planningItems },
      ];
    default:
      return [{ labelKey: 'sidebar.overview', items: common }];
  }
}

export default function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const sections = getNavSections(user?.role ?? 'EMP');

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Brand header */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: 'var(--gradient-primary)' }}>
          <Bus size={18} />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight">{t('common.appName')}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{t('common.brandSub')}</span>
          </div>
        )}
      </div>

      <SidebarContent className="py-2">
        {sections.map((section) => (
          <SidebarGroup key={section.labelKey}>
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-4 mb-1">
              {t(section.labelKey)}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === '/dashboard'}
                        className="rounded-xl mx-2 px-3 py-2 transition-all duration-200 hover:bg-sidebar-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                        activeClassName="bg-primary/10 text-primary font-semibold shadow-sm"
                      >
                        <item.icon className="mr-2.5 h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-[13px]">{t(item.titleKey)}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          {!collapsed && (
            <SidebarMenuItem>
              <div className="px-2 pb-2">
                <LanguageSwitcher variant="full" className="w-full justify-center" />
              </div>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/privacy-policy"
                className="rounded-xl mx-2 px-3 py-2 hover:bg-sidebar-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                activeClassName="bg-primary/10 text-primary"
              >
                <ScrollText className="mr-2.5 h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-[13px]">{t('sidebar.privacyPolicy')}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/data-protection"
                className="rounded-xl mx-2 px-3 py-2 hover:bg-sidebar-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                activeClassName="bg-primary/10 text-primary"
              >
                <ShieldCheck className="mr-2.5 h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-[13px]">{t('sidebar.dataProtection')}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/help-desk"
                className="rounded-xl mx-2 px-3 py-2 hover:bg-sidebar-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                activeClassName="bg-primary/10 text-primary"
              >
                <HelpCircle className="mr-2.5 h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-[13px]">{t('sidebar.helpDesk')}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
