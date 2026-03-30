import { Badge } from '@/components/ui/badge';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-success/15 text-success border-success/30',
  INACTIVE: 'bg-muted text-muted-foreground border-border',
  SUSPENDED: 'bg-destructive/15 text-destructive border-destructive/30',
  PENDING_APPROVAL: 'bg-warning/15 text-warning border-warning/30',
  PENDING: 'bg-warning/15 text-warning border-warning/30',
  CONFIRMED: 'bg-success/15 text-success border-success/30',
  ADJUSTED: 'bg-accent text-accent-foreground border-accent',
  DISPATCHED: 'bg-primary/15 text-primary border-primary/30',
};

export default function StatusBadgeGeneric({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <Badge variant="outline" className={`${style} text-xs font-medium`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
