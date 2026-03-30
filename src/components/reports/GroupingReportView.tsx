import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import PrintableReportLayout from './PrintableReportLayout';
import type { GroupingReportRow, ReportMeta } from '@/types/reports';

interface Props { data: GroupingReportRow[]; meta: ReportMeta }

export default function GroupingReportView({ data, meta }: Props) {
  if (!data || data.length === 0) {
    return (
      <PrintableReportLayout meta={{ ...meta, title: 'Operational Grouping Report' }}>
        <p className="py-8 text-center text-sm text-muted-foreground">No grouping data available for the selected date.</p>
      </PrintableReportLayout>
    );
  }

  return (
    <PrintableReportLayout meta={{ ...meta, title: 'Operational Grouping Report' }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Group</TableHead>
            <TableHead className="text-xs">Route / Corridor</TableHead>
            <TableHead className="text-xs text-right">Members</TableHead>
            <TableHead className="text-xs">Cluster</TableHead>
            <TableHead className="text-xs">Recommended</TableHead>
            <TableHead className="text-xs">Assigned Vehicle</TableHead>
            <TableHead className="text-xs">Driver</TableHead>
            <TableHead className="text-xs">Flag</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((g, i) => (
            <TableRow key={i}>
              <TableCell className="text-xs font-mono font-semibold">{g.groupCode}</TableCell>
              <TableCell className="text-xs">{g.routeCorridor}</TableCell>
              <TableCell className="text-xs text-right">{g.memberCount}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{g.clusterNote || '—'}</TableCell>
              <TableCell className="text-xs">{g.recommendedVehicle || '—'}</TableCell>
              <TableCell className="text-xs font-mono">{g.assignedVehicle || '—'}</TableCell>
              <TableCell className="text-xs">{g.driverName || '—'}</TableCell>
              <TableCell className="text-xs">
                {g.overflowWarning ? (
                  <Badge variant="destructive" className="text-[10px]">OVERFLOW</Badge>
                ) : (
                  <span className="text-[hsl(var(--success))] text-[10px]">OK</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.some(g => g.recommendationReason) && (
        <div className="mt-4 space-y-1">
          <p className="text-xs font-semibold text-foreground">Recommendation Notes</p>
          {data.filter(g => g.recommendationReason).map((g, i) => (
            <p key={i} className="text-[11px] text-muted-foreground">
              <span className="font-mono font-semibold">{g.groupCode}</span>: {g.recommendationReason}
            </p>
          ))}
        </div>
      )}
    </PrintableReportLayout>
  );
}
