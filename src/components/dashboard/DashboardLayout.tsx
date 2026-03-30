import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  LogOut, Moon, Sun, User, Bell,
  LayoutDashboard, Users, Building2, Bus, Route, MapPin, FileText,
  Shield, BarChart3, Settings, ClipboardList, UserPlus, Layers,
  CheckSquare, Truck, UserCheck, HelpCircle, Briefcase, Home, FileSpreadsheet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { ReactNode } from 'react';

const routeMeta: Record<string, { icon: any; labelKey: string }> = {
  '/dashboard': { icon: LayoutDashboard, labelKey: 'sidebar.dashboard' },
  '/emp': { icon: Home, labelKey: 'sidebar.dashboard' },
  '/requests': { icon: ClipboardList, labelKey: 'sidebar.dropOffRequests' },
  '/requests/create': { icon: UserPlus, labelKey: 'sidebar.createRequest' },
  '/employees': { icon: Users, labelKey: 'sidebar.employees' },
  '/departments': { icon: Building2, labelKey: 'sidebar.departments' },
  '/vehicles': { icon: Bus, labelKey: 'sidebar.vehicles' },
  '/drivers': { icon: Truck, labelKey: 'sidebar.drivers' },
  '/routes': { icon: Route, labelKey: 'sidebar.routes' },
  '/places': { icon: MapPin, labelKey: 'sidebar.places' },
  '/grouping': { icon: Layers, labelKey: 'sidebar.grouping' },
  '/approvals': { icon: CheckSquare, labelKey: 'sidebar.approvals' },
  '/hod/requests': { icon: ClipboardList, labelKey: 'sidebar.dropOffRequests' },
  '/admin/approvals': { icon: Shield, labelKey: 'sidebar.approvals' },
  '/ta/processing': { icon: Briefcase, labelKey: 'sidebar.processingQueue' },
  '/hr/approvals': { icon: UserCheck, labelKey: 'sidebar.finalApprovals' },
  '/users': { icon: Users, labelKey: 'sidebar.userManagement' },
  '/audit': { icon: FileText, labelKey: 'sidebar.auditLogs' },
  '/analytics': { icon: BarChart3, labelKey: 'sidebar.analytics' },
  '/reports': { icon: FileText, labelKey: 'sidebar.reports' },
  '/notifications': { icon: Bell, labelKey: 'sidebar.notifications' },
  '/settings': { icon: Settings, labelKey: 'sidebar.settings' },
  '/self-service': { icon: MapPin, labelKey: 'sidebar.selfService' },
  '/emp/transport': { icon: Bus, labelKey: 'sidebar.myDropOff' },
  '/emp/self-service': { icon: MapPin, labelKey: 'sidebar.selfService' },
  '/emp/profile': { icon: User, labelKey: 'sidebar.myProfile' },
  '/emp/help-desk': { icon: HelpCircle, labelKey: 'sidebar.helpDesk' },
  '/emp/notifications': { icon: Bell, labelKey: 'sidebar.notifications' },
  '/hod/bulk-upload': { icon: FileSpreadsheet, labelKey: 'sidebar.bulkUpload' },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  // Find current route meta
  const path = location.pathname;
  const meta = routeMeta[path] || Object.entries(routeMeta).find(([k]) => path.startsWith(k) && k !== '/')?.[1] || null;
  const PageIcon = meta?.icon || LayoutDashboard;
  const pageLabel = meta ? t(meta.labelKey) : '';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="saas-header">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
              <Separator orientation="vertical" className="hidden md:block h-5" />
              {/* Page context icon + label */}
              <div className="hidden md:flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <PageIcon size={14} className="text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">{pageLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" onClick={toggle} className="text-muted-foreground hover:text-foreground rounded-xl h-9 w-9">
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate('/notifications')} className="text-muted-foreground hover:text-foreground rounded-xl h-9 w-9 relative">
                <Bell size={16} />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
              </Button>
              <div className="hidden sm:flex items-center gap-2.5 rounded-xl bg-muted/60 px-3 py-2 ml-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <User size={13} className="text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground leading-none">{user?.fullName}</span>
                  <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{user?.role}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive rounded-xl h-9 w-9 ml-0.5">
                <LogOut size={16} />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
