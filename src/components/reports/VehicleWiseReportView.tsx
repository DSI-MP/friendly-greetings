import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import PrintableReportLayout from './PrintableReportLayout';
import type { VehicleWiseRow, ReportMeta } from '@/types/reports';

interface Props { data: VehicleWiseRow[]; meta: ReportMeta }

export default function VehicleWiseReportView({ data, meta }: Props) {
  if (!data || data.length === 0) {
    return (
      <PrintableReportLayout meta={{ ...meta, title: 'Vehicle-Wise Assignment Report' }}>
        <p className="py-8 text-center text-sm text-muted-foreground">No vehicle assignment data available.</p>
      </PrintableReportLayout>
    );
  }

  return (
    <PrintableReportLayout meta={{ ...meta, title: 'Vehicle-Wise Assignment Report' }}>
      {data.map((v, i) => {
        // Bug fix #12: Guard capacity 0 / NaN
        const capacity = v.capacity && v.capacity > 0 ? v.capacity : 0;
        const occupancy = v.occupancy ?? v.employees?.length ?? 0;
        const pct = capacity > 0 ? Math.min((occupancy / capacity) * 100, 100) : 0;
        const overflow = capacity > 0 ? occupancy > capacity : false;

        return (
          <div key={i} className="mb-6 rounded-lg border border-border p-4 print:border print:border-gray-300 print:p-3 print:break-inside-avoid">
            <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-foreground print:text-black font-mono">{v.vehicleReg || '—'}</h3>
                <p className="text-xs text-muted-foreground">{v.vehicleType || 'Vehicle'} · Driver: {v.driverName || '—'} · {v.driverPhone || ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {overflow && <Badge variant="destructive" className="text-[10px]">OVERFLOW</Badge>}
                <span className="text-xs font-semibold text-foreground">
                  {occupancy}/{capacity > 0 ? capacity : <span className="text-muted-foreground italic">N/A</span>}
                </span>
              </div>
            </div>
            {capacity > 0 ? (
              <div className="mb-3">
                <Progress value={pct} className="h-2" />
              </div>
            ) : (
              <div className="mb-3 text-[10px] text-muted-foreground italic">Capacity not set</div>
            )}
            <div className="flex flex-wrap gap-2 mb-2">
              {(v.groupCodes || []).map(g => (
                <Badge key={g} variant="outline" className="text-[10px] font-mono">{g}</Badge>
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-10">#</TableHead>
                  <TableHead className="text-xs">Emp No</TableHead>
                  <TableHead className="text-xs">Employee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(v.employees || []).map((e, j) => (
                  <TableRow key={`${e.empNo || j}`}>
                    <TableCell className="text-xs w-10">{j + 1}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{e.empNo || '—'}</TableCell>
                    <TableCell className="text-xs">{e.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
      <div className="mt-4 text-xs text-muted-foreground print:text-gray-500">
        Total vehicles: {data.length} · Total passengers: {data.reduce((s, v) => s + (v.employees?.length || 0), 0)}
      </div>
    </PrintableReportLayout>
  );
}
