import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import PrintableReportLayout from './PrintableReportLayout';
import type { DepartmentSummaryRow, ReportMeta } from '@/types/reports';

interface Props { data: DepartmentSummaryRow[]; meta: ReportMeta }

export default function DepartmentSummaryReportView({ data, meta }: Props) {
  if (!data || data.length === 0) {
    return (
      <PrintableReportLayout meta={{ ...meta, title: 'Department-Wise Summary Report' }}>
        <p className="py-8 text-center text-sm text-muted-foreground">No department data available for the selected date.</p>
      </PrintableReportLayout>
    );
  }

  const totalEmp = data.reduce((s, d) => s + (d.totalEmployees || 0), 0);
  const totalAssigned = data.reduce((s, d) => s + (d.assignedEmployees || 0), 0);

  return (
    <PrintableReportLayout meta={{ ...meta, title: 'Department-Wise Summary Report' }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Department</TableHead>
            <TableHead className="text-xs">Request</TableHead>
            <TableHead className="text-xs text-right">Total</TableHead>
            <TableHead className="text-xs text-right">Assigned</TableHead>
            <TableHead className="text-xs text-right">Unassigned</TableHead>
            <TableHead className="text-xs">Approval</TableHead>
            <TableHead className="text-xs">Report</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((d, i) => (
            <TableRow key={i}>
              <TableCell className="text-xs font-medium">{d.departmentName}</TableCell>
              <TableCell className="text-xs font-mono">{d.requestCode}</TableCell>
              <TableCell className="text-xs text-right">{d.totalEmployees}</TableCell>
              <TableCell className="text-xs text-right">{d.assignedEmployees}</TableCell>
              <TableCell className="text-xs text-right">
                {(d.unassignedEmployees || 0) > 0 ? (
                  <span className="text-destructive font-semibold">{d.unassignedEmployees}</span>
                ) : '0'}
              </TableCell>
              <TableCell className="text-xs">
                <Badge
                  variant={
                    ['READY', 'DISPATCHED', 'HR_APPROVED'].includes(d.approvedStatus || '')
                      ? 'default'
                      : ['CLOSED', 'ARCHIVED'].includes(d.approvedStatus || '')
                        ? 'outline'
                        : 'secondary'
                  }
                  className="text-[10px]"
                >
                  {(d.approvedStatus || 'UNKNOWN').replace(/_/g, ' ')}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {d.reportReady ? (
                  <span className="text-[hsl(var(--success))] font-semibold text-[10px]">● Ready</span>
                ) : (
                  <span className="text-muted-foreground text-[10px]">○ Pending</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 text-xs text-muted-foreground print:text-gray-500">
        Total employees: {totalEmp} · Assigned: {totalAssigned} · Departments: {data.length}
      </div>
    </PrintableReportLayout>
  );
}
