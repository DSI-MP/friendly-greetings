import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import PrintableReportLayout from './PrintableReportLayout';
import type { ArchiveReportRow, ReportMeta } from '@/types/reports';

interface Props { data: ArchiveReportRow[]; meta: ReportMeta }

export default function ArchiveReportsView({ data, meta }: Props) {
  if (!data || data.length === 0) {
    return (
      <PrintableReportLayout meta={{ ...meta, title: 'Archive / Historical Reports' }}>
        <p className="py-8 text-center text-sm text-muted-foreground">No archived report history available.</p>
      </PrintableReportLayout>
    );
  }

  return (
    <PrintableReportLayout meta={{ ...meta, title: 'Archive / Historical Reports' }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Request</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Closed</TableHead>
            <TableHead className="text-xs">Department</TableHead>
            <TableHead className="text-xs text-right">Employees</TableHead>
            <TableHead className="text-xs text-right">Groups</TableHead>
            <TableHead className="text-xs text-right">Vehicles</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="text-xs font-mono font-semibold">{r.requestCode}</TableCell>
              <TableCell className="text-xs">{r.requestDate}</TableCell>
              <TableCell className="text-xs">{r.closedDate || '—'}</TableCell>
              <TableCell className="text-xs">{r.departmentName || '—'}</TableCell>
              <TableCell className="text-xs text-right">{r.totalEmployees}</TableCell>
              <TableCell className="text-xs text-right">{r.totalGroups}</TableCell>
              <TableCell className="text-xs text-right">{r.totalVehicles}</TableCell>
              <TableCell className="text-xs">
                <Badge variant="secondary" className="text-[10px]">{r.finalStatus}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        Archived reports are read-only historical records. Data reflects the final approved state at the time of closure.
      </div>
    </PrintableReportLayout>
  );
}
