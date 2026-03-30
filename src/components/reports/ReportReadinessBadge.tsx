import { Badge } from '@/components/ui/badge';
import type { ReportReadiness } from '@/types/reports';
import { CheckCircle, Eye, Clock, Loader2, ShieldAlert, Archive, XCircle } from 'lucide-react';

const CONFIG: Record<ReportReadiness, { label: string; icon: typeof CheckCircle; className: string }> = {
  ready: { label: 'Ready for PDF', icon: CheckCircle, className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/30' },
  preview: { label: 'Preview Only', icon: Eye, className: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30' },
  'awaiting-grouping': { label: 'Awaiting Grouping', icon: Clock, className: 'bg-muted text-muted-foreground border-border' },
  'awaiting-assignment': { label: 'Awaiting TA Assignment', icon: Loader2, className: 'bg-muted text-muted-foreground border-border' },
  'awaiting-hr-approval': { label: 'Awaiting HR Approval', icon: ShieldAlert, className: 'bg-primary/10 text-primary border-primary/30' },
  archived: { label: 'Archived (Read-Only)', icon: Archive, className: 'bg-secondary text-secondary-foreground border-border' },
  unavailable: { label: 'No Run Data', icon: XCircle, className: 'bg-muted text-muted-foreground border-border' },
};

export default function ReportReadinessBadge({ readiness }: { readiness: ReportReadiness }) {
  const c = CONFIG[readiness];
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`gap-1.5 px-2.5 py-1 text-xs font-medium ${c.className}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}
