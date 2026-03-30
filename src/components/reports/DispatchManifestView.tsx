import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PrintableReportLayout from './PrintableReportLayout';
import type { DispatchManifestRow, ReportMeta } from '@/types/reports';
import { User, Bus, MapPin } from 'lucide-react';

interface Props { data: DispatchManifestRow[]; meta: ReportMeta }

export default function DispatchManifestView({ data, meta }: Props) {
  if (!data || data.length === 0) {
    return (
      <PrintableReportLayout meta={{ ...meta, title: 'Final Dispatch Manifest' }}>
        <p className="py-8 text-center text-sm text-muted-foreground">No dispatch data available for the selected date.</p>
      </PrintableReportLayout>
    );
  }

  return (
    <PrintableReportLayout meta={{ ...meta, title: 'Final Dispatch Manifest' }}>
      {data.map((m, i) => {
        // Build unique drop-point list in sequence order
        const dropPoints: string[] = [];
        const sorted = [...(m.employees || [])].sort((a, b) => (a.sequence ?? 99) - (b.sequence ?? 99));
        for (const e of sorted) {
          if (e.destination && !dropPoints.includes(e.destination) && e.destination !== 'Unknown Location') {
            dropPoints.push(e.destination);
          }
        }

        return (
          <div key={i} className="mb-6">
            <div className="rounded-lg border border-border overflow-hidden print:border print:border-gray-400">
              {/* Dispatch card header */}
              <div className="bg-muted/50 px-4 py-2.5 print:bg-gray-100 print:px-3 print:py-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground print:text-black leading-tight flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0 print:hidden" />
                      {m.groupCode}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Date: {m.requestDate}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-foreground print:text-black shrink-0">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground print:hidden" />
                      <span className="font-medium">{m.driverName || '—'}</span>
                      {m.driverPhone && <span className="text-muted-foreground">({m.driverPhone})</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bus className="h-3 w-3 text-muted-foreground print:hidden" />
                      <span className="font-semibold font-mono">{m.vehicleReg || '—'}</span>
                    </span>
                  </div>
                </div>

                {/* Bug fix #9: Drop-point list */}
                {dropPoints.length > 0 && (
                  <div className="mt-1.5 text-[11px] text-muted-foreground print:text-gray-600 leading-relaxed">
                    <span className="font-semibold text-foreground print:text-black">Stops: </span>
                    {dropPoints.join(' → ')}
                  </div>
                )}
              </div>

              {m.notes && (
                <div className="mx-4 my-2 rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground print:bg-gray-100">
                  <span className="font-semibold">Instructions: </span>{m.notes}
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] w-14 print:text-[8pt]">Drop #</TableHead>
                    <TableHead className="text-[10px] print:text-[8pt]">Emp No</TableHead>
                    <TableHead className="text-[10px] print:text-[8pt]">Employee</TableHead>
                    <TableHead className="text-[10px] print:text-[8pt]">Destination</TableHead>
                    <TableHead className="text-[10px] w-24 hidden print:table-cell print:text-[8pt]">Signature</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((e, j) => (
                    <TableRow key={`${e.empNo || j}-${j}`}>
                      <TableCell className="text-[10px] font-semibold print:py-0.5">{e.sequence}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground print:py-0.5">{e.empNo || '—'}</TableCell>
                      <TableCell className="text-[11px] font-medium print:py-0.5">{e.name}</TableCell>
                      <TableCell className="text-[11px] print:py-0.5">{e.destination || 'Unnamed Drop Point'}</TableCell>
                      <TableCell className="text-xs hidden print:table-cell print:py-0.5">
                        <div className="border-b border-dashed border-gray-400 h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Group footer */}
              <div className="px-4 py-1.5 bg-muted/30 text-[10px] text-muted-foreground print:bg-gray-50 print:px-3 flex items-center justify-between">
                <span>{sorted.length} employee{sorted.length !== 1 ? 's' : ''}</span>
                <span>{dropPoints.length} stop{dropPoints.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Print-only acknowledgement */}
              <div className="hidden print:block px-4 py-4 border-t border-gray-300">
                <div className="grid grid-cols-2 gap-8 text-[10px] text-gray-600">
                  <div>
                    <p className="mb-6">Driver Signature: ___________________________</p>
                    <p>Date/Time: ___________________________</p>
                  </div>
                  <div>
                    <p className="mb-6">Supervisor Signature: ___________________________</p>
                    <p>Date/Time: ___________________________</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="mt-4 text-xs text-muted-foreground print:text-gray-500">
        Total groups: {data.length} · Total passengers: {data.reduce((s, m) => s + (m.employees?.length || 0), 0)}
      </div>
    </PrintableReportLayout>
  );
}
