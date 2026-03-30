import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '@/components/transport/StatusBadge';
import type { StatusHistoryEntry } from '@/lib/mockWorkflowData';

interface Props {
  history: StatusHistoryEntry[];
}

export default function RequestStatusHistoryPanel({ history }: Props) {
  if (!history.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Status History</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-semibold">Status History</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Changed By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((h) => (
              <TableRow key={h.id}>
                <TableCell><StatusBadge status={h.from_status} /></TableCell>
                <TableCell><StatusBadge status={h.to_status} /></TableCell>
                <TableCell className="text-sm">{h.changed_by}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(h.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{h.reason || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
