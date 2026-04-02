import { HashRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { lazy, Suspense, type ReactNode } from 'react';
import DashboardLayout from './components/dashboard/DashboardLayout';

// ── Eager: auth/public pages (small, always needed) ──
import LoginPage from './pages/LoginPage';
import SelfRegisterPage from './pages/SelfRegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import HelpDeskPage from './pages/HelpDeskPage';
import DashboardPage from './pages/DashboardPage';

// ── Lazy: heavy / infrequently-visited pages ──
const TransportRequestsPage = lazy(() => import('./pages/TransportRequestsPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const VehiclesPage = lazy(() => import('./pages/VehiclesPage'));
const DriversPage = lazy(() => import('./pages/DriversPage'));
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage'));
const PlacesPage = lazy(() => import('./pages/PlacesPage'));
const RoutesPage = lazy(() => import('./pages/RoutesPage'));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const DataProtectionPage = lazy(() => import('./pages/DataProtectionPage'));
const SystemInfoPage = lazy(() => import('./pages/SystemInfoPage'));
const SelfServicePage = lazy(() => import('./pages/SelfServicePage'));
const EmpDashboardPage = lazy(() => import('./pages/EmpDashboardPage'));
const EmpSelfServicePage = lazy(() => import('./pages/EmpSelfServicePage'));
const EmpProfilePage = lazy(() => import('./pages/EmpProfilePage'));
const EmpTransportPage = lazy(() => import('./pages/EmpTransportPage'));
const HodRequestsPage = lazy(() => import('./pages/HodRequestsPage'));
const RequestCreatePage = lazy(() => import('./pages/RequestCreatePage'));
const RequestDetailPage = lazy(() => import('./pages/RequestDetailPage'));
const AdminApprovalsPage = lazy(() => import('./pages/AdminApprovalsPage'));
const AdminDailyLockPage = lazy(() => import('./pages/AdminDailyLockPage'));
const LocationUpdateRequestsPage = lazy(() => import('./pages/LocationUpdateRequestsPage'));
const TaProcessingPage = lazy(() => import('./pages/TaProcessingPage'));
const TaAssignmentBoardPage = lazy(() => import('./pages/TaAssignmentBoardPage'));
const HrFinalApprovalsPage = lazy(() => import('./pages/HrFinalApprovalsPage'));
const EmployeeExportPage = lazy(() => import('./pages/EmployeeExportPage'));
const BulkEmployeeUploadPage = lazy(() => import('./pages/BulkEmployeeUploadPage'));
const BulkVehicleUploadPage = lazy(() => import('./pages/BulkVehicleUploadPage'));
const RouteMapPage = lazy(() => import('./pages/RouteMapPage'));
const OtPlanPage = lazy(() => import('./pages/OtPlanPage'));

function LazyFallback() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/** Role sets for route protection */
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;
const HOD_PLUS = ['HOD', 'ADMIN', 'SUPER_ADMIN'] as const;
const TA_PLUS = ['TRANSPORT_AUTHORITY', 'ADMIN', 'SUPER_ADMIN'] as const;
const HR_PLUS = ['HR', 'SUPER_ADMIN'] as const;
const PLANNING_PLUS = ['PLANNING', 'HR', 'ADMIN', 'SUPER_ADMIN'] as const;
const ALL_STAFF = ['HOD', 'ADMIN', 'SUPER_ADMIN', 'HR', 'TRANSPORT_AUTHORITY', 'PLANNING'] as const;
const EMP_ONLY = ['EMP'] as const;

function getDefaultRoute(role?: string): string {
  if (role === 'EMP') return '/emp';
  return '/dashboard';
}

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: readonly string[] }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  // Role check
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = allowedRoles.includes(user.role) || user.role === 'SUPER_ADMIN';
    if (!hasRole) {
      return <Navigate to={getDefaultRoute(user.role)} replace />;
    }
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={getDefaultRoute(user.role)} replace />;
  return <>{children}</>;
}

/** Wrap a lazy component in Suspense inside ProtectedRoute with optional role restriction */
function P({ children, roles }: { children: ReactNode; roles?: readonly string[] }) {
  return (
    <ProtectedRoute allowedRoles={roles}>
      <Suspense fallback={<LazyFallback />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <HashRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/self-register" element={<PublicRoute><SelfRegisterPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/help-desk" element={<HelpDeskPage />} />

            {/* EMP-only routes */}
            <Route path="/emp" element={<P roles={EMP_ONLY}><EmpDashboardPage /></P>} />
            <Route path="/emp/transport" element={<P roles={EMP_ONLY}><EmpTransportPage /></P>} />
            <Route path="/emp/notifications" element={<P roles={EMP_ONLY}><NotificationsPage /></P>} />
            <Route path="/emp/self-service" element={<P roles={EMP_ONLY}><EmpSelfServicePage /></P>} />
            <Route path="/emp/help-desk" element={<P roles={EMP_ONLY}><HelpDeskPage /></P>} />
            <Route path="/emp/profile" element={<P roles={EMP_ONLY}><EmpProfilePage /></P>} />

            {/* Protected - Dashboard (all staff roles) */}
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={ALL_STAFF}><DashboardPage /></ProtectedRoute>} />

            {/* Protected - Operations */}
            <Route path="/requests" element={<P roles={ALL_STAFF}><TransportRequestsPage /></P>} />
            <Route path="/requests/create" element={<P roles={HOD_PLUS}><RequestCreatePage /></P>} />
            <Route path="/requests/:id/edit" element={<P roles={HOD_PLUS}><RequestCreatePage /></P>} />
            <Route path="/requests/:id" element={<P roles={ALL_STAFF}><RequestDetailPage /></P>} />
            <Route path="/employees" element={<P roles={ALL_STAFF}><EmployeesPage /></P>} />
            <Route path="/departments" element={<P roles={ALL_STAFF}><DepartmentsPage /></P>} />
            <Route path="/vehicles" element={<P roles={[...TA_PLUS]}><VehiclesPage /></P>} />
            <Route path="/drivers" element={<P roles={[...TA_PLUS]}><DriversPage /></P>} />
            <Route path="/routes" element={<P roles={[...TA_PLUS]}><RoutesPage /></P>} />
            <Route path="/places" element={<P roles={ALL_STAFF}><PlacesPage /></P>} />
            <Route path="/approvals" element={<P roles={ALL_STAFF}><ApprovalsPage /></P>} />
            <Route path="/self-service" element={<P roles={ALL_STAFF}><SelfServicePage /></P>} />

            {/* HOD workflow */}
            <Route path="/hod/requests" element={<P roles={HOD_PLUS}><HodRequestsPage /></P>} />
            <Route path="/hod/bulk-upload" element={<P roles={HOD_PLUS}><BulkEmployeeUploadPage /></P>} />

            {/* Admin workflow */}
            <Route path="/admin/approvals" element={<P roles={ADMIN_ROLES}><AdminApprovalsPage /></P>} />
            <Route path="/admin/daily-lock" element={<P roles={ADMIN_ROLES}><AdminDailyLockPage /></P>} />
            <Route path="/admin/location-requests" element={<P roles={ADMIN_ROLES}><LocationUpdateRequestsPage /></P>} />

            {/* TA workflow */}
            <Route path="/ta/processing" element={<P roles={TA_PLUS}><TaProcessingPage /></P>} />
            <Route path="/ta/assignments/daily/:date" element={<P roles={TA_PLUS}><TaAssignmentBoardPage /></P>} />
            <Route path="/ta/assignments/:requestId" element={<P roles={TA_PLUS}><TaProcessingPage /></P>} />
            <Route path="/grouping" element={<P roles={TA_PLUS}><TaProcessingPage /></P>} />
            <Route path="/route-map/daily/:date" element={<P roles={TA_PLUS}><RouteMapPage /></P>} />
            <Route path="/ta/bulk-vehicle-upload" element={<P roles={TA_PLUS}><BulkVehicleUploadPage /></P>} />
            <Route path="/route-map/:requestId" element={<P roles={TA_PLUS}><TaProcessingPage /></P>} />
            <Route path="/route-map" element={<Navigate to="/ta/processing" replace />} />

            {/* HR workflow */}
            <Route path="/hr/approvals" element={<P roles={HR_PLUS}><HrFinalApprovalsPage /></P>} />
            <Route path="/planning/ot-plan" element={<P roles={PLANNING_PLUS}><OtPlanPage /></P>} />
            <Route path="/hr/export" element={<P roles={HR_PLUS}><EmployeeExportPage /></P>} />

            {/* Admin export */}
            <Route path="/admin/export" element={<P roles={ADMIN_ROLES}><EmployeeExportPage /></P>} />

            {/* Protected - Management */}
            <Route path="/users" element={<P roles={ADMIN_ROLES}><UsersPage /></P>} />
            <Route path="/audit" element={<P roles={ADMIN_ROLES}><AuditPage /></P>} />
            <Route path="/analytics" element={<P roles={ADMIN_ROLES}><AnalyticsPage /></P>} />
            <Route path="/reports" element={<P roles={ALL_STAFF}><ReportsPage /></P>} />
            <Route path="/notifications" element={<P><NotificationsPage /></P>} />
            <Route path="/settings" element={<P roles={ADMIN_ROLES}><SettingsPage /></P>} />
            <Route path="/privacy-policy" element={<P><PrivacyPolicyPage /></P>} />
            <Route path="/data-protection" element={<P><DataProtectionPage /></P>} />
            <Route path="/system-info" element={<P roles={ADMIN_ROLES}><SystemInfoPage /></P>} />

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
