import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import PrintableReportLayout from './PrintableReportLayout';
import type { ExceptionRow, ReportMeta } from '@/types/reports';
import { AlertTriangle, MapPinOff, Users, AlertCircle, XCircle } from 'lucide-react';

const TYPE_LABELS: Record<ExceptionRow['type'], { label: string; icon: typeof AlertTriangle }> = {
  'unresolved-location': { label: 'Unresolved Location', icon: MapPinOff },
  overflow: { label: 'Capacity Overflow', icon: AlertTriangle },
  unassigned: { label: 'Unassigned Group', icon: Users },
  warning: { label: 'Warning', icon: AlertCircle },
  rejected: { label: 'Rejected / Failed', icon: XCircle },
};

const SEV_COLORS: Record<ExceptionRow['severity'], string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  low: 'bg-muted text-muted-foreground border-border',
};

interface Props { data: ExceptionRow[]; meta: ReportMeta }

export default function ExceptionReportView({ data, meta }: Props) {
  if (!data || data.length === 0) {
    return (
      <PrintableReportLayout meta={{ ...meta, title: 'Exception Report' }}>
        <p className="py-8 text-center text-sm text-muted-foreground">No exceptions found for the selected date. All clear!</p>
      </PrintableReportLayout>
    );
  }

  const highCount = data.filter(e => e.severity === 'high').length;

  return (
    <PrintableReportLayout meta={{ ...meta, title: 'Exception Report' }}>
      {highCount > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{highCount} high-severity issue{highCount > 1 ? 's' : ''} detected</span>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Severity</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs">Group / Employee</TableHead>
            <TableHead className="text-xs">Request</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((e, i) => {
            const t = TYPE_LABELS[e.type] || { label: e.type, icon: AlertCircle };
            return (
              <TableRow key={i}>
                <TableCell className="text-xs">
                  <Badge variant="outline" className={`text-[10px] ${SEV_COLORS[e.severity] || ''}`}>
                    {e.severity?.toUpperCase() || 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{e.description}</TableCell>
                <TableCell className="text-xs font-mono">{e.groupCode || (e.employeeNo ? `${e.employeeNo} – ${e.employeeName}` : e.employeeName) || '—'}</TableCell>
                <TableCell className="text-xs font-mono">{e.requestCode}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="mt-4 text-xs text-muted-foreground">
        Total exceptions: {data.length}
      </div>
    </PrintableReportLayout>
  );
}
