import { Check, X, Clock, Loader2, Lock, Truck, Users, FileCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RequestStatus } from '@/types/transport';

interface TimelineStep {
  status: RequestStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: TimelineStep[] = [
  { status: 'SUBMITTED', label: 'HOD Submitted', icon: FileCheck },
  { status: 'ADMIN_APPROVED', label: 'Admin Reviewed', icon: Check },
  { status: 'DAILY_LOCKED', label: 'Daily Run Locked', icon: Lock },
  { status: 'TA_PROCESSING', label: 'Drop-Off Grouping', icon: Loader2 },
  { status: 'GROUPING_COMPLETED', label: 'Destinations Grouped', icon: Users },
  { status: 'TA_COMPLETED', label: 'Vehicles Assigned', icon: Truck },
  { status: 'HR_APPROVED', label: 'HR Final Approval', icon: Check },
];

const STATUS_ORDER: RequestStatus[] = [
  'DRAFT', 'SUBMITTED', 'ADMIN_APPROVED', 'DAILY_LOCKED',
  'TA_PROCESSING', 'GROUPING_COMPLETED', 'TA_COMPLETED', 'HR_APPROVED', 'DISPATCHED', 'CLOSED',
];

const REJECTED_STATUSES: RequestStatus[] = ['ADMIN_REJECTED', 'HR_REJECTED', 'CANCELLED'];

function getStepState(stepStatus: RequestStatus, currentStatus: RequestStatus): 'completed' | 'active' | 'rejected' | 'pending' {
  if (REJECTED_STATUSES.includes(currentStatus)) {
    const rejMap: Record<string, RequestStatus> = {
      ADMIN_REJECTED: 'ADMIN_APPROVED',
      HR_REJECTED: 'HR_APPROVED',
      CANCELLED: 'SUBMITTED',
    };
    const failAt = rejMap[currentStatus] || currentStatus;
    const stepIdx = STATUS_ORDER.indexOf(stepStatus);
    const failIdx = STATUS_ORDER.indexOf(failAt);
    if (stepIdx < failIdx) return 'completed';
    if (stepStatus === failAt) return 'rejected';
    return 'pending';
  }
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const stepIdx = STATUS_ORDER.indexOf(stepStatus);
  if (stepIdx < currentIdx) return 'completed';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

interface Props {
  currentStatus: RequestStatus;
  statusHistory?: { to_status?: RequestStatus; changed_by?: string; created_at?: string }[];
  compact?: boolean;
}

export default function WorkflowTimelinePanel({ currentStatus, statusHistory = [], compact }: Props) {
  const getTimestamp = (status: RequestStatus) => {
    const entry = statusHistory.find(h => h.to_status === status);
    return entry ? new Date(entry.created_at).toLocaleString() : undefined;
  };
  const getActor = (status: RequestStatus) => {
    const entry = statusHistory.find(h => h.to_status === status);
    return entry?.changed_by;
  };

  return (
    <Card>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <CardTitle className="text-sm font-semibold">Drop-Off Workflow Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {STEPS.map((step, i) => {
            const state = getStepState(step.status, currentStatus);
            const ts = getTimestamp(step.status);
            const actor = getActor(step.status);
            const isLast = i === STEPS.length - 1;

            return (
              <div key={step.status} className="flex gap-3 pb-4 last:pb-0">
                {/* Connector line */}
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                    state === 'completed' ? 'border-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]' :
                    state === 'active' ? 'border-primary bg-primary/10' :
                    state === 'rejected' ? 'border-destructive bg-destructive/10' :
                    'border-border bg-muted'
                  }`}>
                    {state === 'completed' ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> :
                     state === 'rejected' ? <X className="h-4 w-4 text-destructive" /> :
                     state === 'active' ? <step.icon className="h-4 w-4 text-primary" /> :
                     <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 flex-1 min-h-[16px] ${
                      state === 'completed' ? 'bg-[hsl(var(--success)/0.3)]' : 'bg-border'
                    }`} />
                  )}
                </div>
                {/* Content */}
                <div className="pt-1 pb-1">
                  <p className={`text-sm font-medium ${
                    state === 'completed' ? 'text-foreground' :
                    state === 'active' ? 'text-primary' :
                    state === 'rejected' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}>{step.label}</p>
                  {!compact && (ts || actor) && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {actor && <span>{actor}</span>}
                      {actor && ts && <span> · </span>}
                      {ts && <span>{ts}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
