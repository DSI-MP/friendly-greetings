import { Badge } from '@/components/ui/badge';
import type { RequestStatus } from '@/types/transport';

const STATUS_CONFIG: Record<RequestStatus, { label: string; className: string }> = {
  DRAFT:              { label: 'Draft',        className: 'bg-muted text-muted-foreground border-border' },
  SUBMITTED:          { label: 'Submitted',    className: 'bg-accent text-accent-foreground border-accent' },
  ADMIN_APPROVED:     { label: 'Approved',     className: 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]' },
  ADMIN_REJECTED:     { label: 'Rejected',     className: 'bg-destructive/15 text-destructive border-destructive/30' },
  DAILY_LOCKED:       { label: 'Locked',       className: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)]' },
  TA_PROCESSING:      { label: 'Processing',   className: 'bg-accent text-accent-foreground border-accent' },
  GROUPING_COMPLETED: { label: 'Grouped',      className: 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]' },
  TA_COMPLETED:       { label: 'TA Done',      className: 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]' },
  HR_APPROVED:        { label: 'HR Approved',  className: 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]' },
  HR_REJECTED:        { label: 'HR Rejected',  className: 'bg-destructive/15 text-destructive border-destructive/30' },
  DISPATCHED:         { label: 'Dispatched',   className: 'bg-primary/15 text-primary border-primary/30' },
  CLOSED:             { label: 'Closed',       className: 'bg-muted text-muted-foreground border-border' },
  ARCHIVED:           { label: 'Archived',     className: 'bg-muted text-muted-foreground border-border' },
  CANCELLED:          { label: 'Cancelled',    className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export default function StatusBadge({ status }: { status: RequestStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: '' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}
