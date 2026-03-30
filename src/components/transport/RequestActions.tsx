import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Send, CheckCircle, XCircle, Ban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/translateError';
import type { TransportRequest } from '@/types/transport';
import type { Role } from '@/types/auth';

interface Props {
  request: TransportRequest;
  role: Role;
  onActionComplete: () => void;
}

/**
 * V2 Request Actions — no daily lock per-request, no TA grouping per-request.
 * Daily lock is done from Admin Daily Lock page.
 * Grouping is done from TA Processing Queue.
 */
export default function RequestActions({ request, role, onActionComplete }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const act = async (url: string, label: string, body?: object) => {
    setLoading(true);
    try {
      await api.post(url, body);
      toast({ title: 'Success', description: `${label} completed.` });
      onActionComplete();
    } catch (err: any) {
      toast({ title: 'Error', description: getApiErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const actions: { label: string; icon: React.ReactNode; onClick: () => void; show: boolean }[] = [
    {
      label: 'Submit',
      icon: <Send className="mr-2 h-4 w-4" />,
      onClick: () => act(`/transport-requests/${request.id}/submit`, 'Submit'),
      show: request.status === 'DRAFT' && role === 'HOD',
    },
    {
      label: 'Approve',
      icon: <CheckCircle className="mr-2 h-4 w-4" />,
      onClick: () => act(`/transport-requests/${request.id}/admin-approve`, 'Approval'),
      show: request.status === 'SUBMITTED' && (role === 'ADMIN' || role === 'SUPER_ADMIN'),
    },
    {
      label: 'Reject',
      icon: <XCircle className="mr-2 h-4 w-4" />,
      onClick: () => act(`/transport-requests/${request.id}/admin-reject`, 'Rejection'),
      show: request.status === 'SUBMITTED' && (role === 'ADMIN' || role === 'SUPER_ADMIN'),
    },
    {
      label: 'Cancel',
      icon: <Ban className="mr-2 h-4 w-4" />,
      onClick: () => act(`/transport-requests/${request.id}/cancel`, 'Cancellation'),
      show: ['DRAFT', 'SUBMITTED'].includes(request.status) &&
        (role === 'HOD' || role === 'ADMIN' || role === 'SUPER_ADMIN'),
    },
  ];

  const visible = actions.filter(a => a.show);
  if (visible.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visible.map(a => (
          <DropdownMenuItem key={a.label} onClick={a.onClick}>
            {a.icon}{a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
