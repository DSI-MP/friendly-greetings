import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * Legacy /approvals route — redirects to the correct role-specific approvals page.
 */
export default function ApprovalsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    if (user.role === 'HR' || user.role === 'SUPER_ADMIN') {
      navigate('/hr/approvals', { replace: true });
    } else if (user.role === 'ADMIN') {
      navigate('/admin/approvals', { replace: true });
    } else if (user.role === 'HOD') {
      navigate('/hod/requests', { replace: true });
    } else if (user.role === 'TRANSPORT_AUTHORITY') {
      navigate('/ta/processing', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
