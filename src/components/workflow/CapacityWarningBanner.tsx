import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  unresolvedCount: number;
  overflowGroups: number;
  totalGroups: number;
}

export default function CapacityWarningBanner({ unresolvedCount, overflowGroups, totalGroups }: Props) {
  if (unresolvedCount === 0 && overflowGroups === 0) return null;

  return (
    <Alert variant="destructive" className="border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] text-foreground">
      <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
      <AlertTitle className="text-sm font-semibold">Attention Required</AlertTitle>
      <AlertDescription className="text-xs space-y-1">
        {unresolvedCount > 0 && <p>{unresolvedCount} employee(s) have unresolved pickup locations.</p>}
        {overflowGroups > 0 && <p>{overflowGroups} of {totalGroups} group(s) exceed vehicle capacity.</p>}
      </AlertDescription>
    </Alert>
  );
}
