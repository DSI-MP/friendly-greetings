import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PrintableReportLayout from './PrintableReportLayout';
import type { RouteWiseRow, ReportMeta } from '@/types/reports';
import { Bus, User, MapPin } from 'lucide-react';

interface Props { data: RouteWiseRow[]; meta: ReportMeta }

interface RouteGroup {
  routeName: string;
  groupCode: string;
  driverName: string;
  driverPhone: string;
  vehicleReg: string;
  stops: string[];
  employees: RouteWiseRow[];
}

function buildRouteGroups(data: RouteWiseRow[]): RouteGroup[] {
  const map = new Map<string, RouteGroup>();

  for (const row of data) {
    const key = row.groupCode || row.routeName;
    if (!map.has(key)) {
      map.set(key, {
        routeName: row.routeName || 'Unknown Route',
        groupCode: row.groupCode || '',
        driverName: row.driverName || '—',
        driverPhone: row.driverPhone || '',
        vehicleReg: row.vehicleReg || '—',
        stops: row.stops || [],
        employees: [],
      });
    }
    const group = map.get(key)!;
    // Bug fix #6: Deduplicate by employeeNo (stable key), fallback to name
    const dedupKey = row.employeeNo || row.employeeName;
    if (!group.employees.some(e => (e.employeeNo || e.employeeName) === dedupKey)) {
      group.employees.push(row);
    }
    // Merge stops
    if (row.stops) {
      for (const s of row.stops) {
        if (s && !group.stops.includes(s)) group.stops.push(s);
      }
    }
    // Also add individual destination to stops if not present
    if (row.destination && row.destination !== 'Unknown Location' && row.destination !== 'Unnamed Drop Point' && !group.stops.includes(row.destination)) {
      group.stops.push(row.destination);
    }
  }

  return Array.from(map.values());
}

export default function RouteWiseReportView({ data, meta }: Props) {
  if (!data || data.length === 0) {
    return (
      <PrintableReportLayout meta={{ ...meta, title: 'Route-Wise Drop-Off Report' }}>
        <p className="py-8 text-center text-sm text-muted-foreground">No route data available for the selected date.</p>
      </PrintableReportLayout>
    );
  }

  const routeGroups = buildRouteGroups(data);

  return (
    <PrintableReportLayout meta={{ ...meta, title: 'Route-Wise Drop-Off Report' }}>
      <div className="space-y-4 print:space-y-3">
        {routeGroups.map((group, idx) => (
          <div key={group.groupCode || idx} className="border border-border rounded-lg overflow-hidden print:border-gray-300 print-route-block">
            {/* Route Header Block */}
            <div className="bg-muted/50 px-4 py-2.5 print:bg-gray-100 print:px-3 print:py-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground print:text-black leading-tight flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0 print:hidden" />
                    {group.routeName}
                  </h3>
                  <p className="text-[10px] text-muted-foreground print:text-gray-500 mt-0.5 font-mono">
                    {group.groupCode}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-foreground print:text-black shrink-0">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground print:hidden" />
                    <span className="font-medium">{group.driverName}</span>
                    {group.driverPhone && (
                      <span className="text-muted-foreground print:text-gray-500">({group.driverPhone})</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bus className="h-3 w-3 text-muted-foreground print:hidden" />
                    <span className="font-semibold font-mono">{group.vehicleReg}</span>
                  </span>
                </div>
              </div>

              {/* Drop-Point List */}
              {group.stops.length > 0 && (
                <div className="mt-1.5 text-[11px] text-muted-foreground print:text-gray-600 leading-relaxed">
                  <span className="font-semibold text-foreground print:text-black">Stops: </span>
                  {group.stops.join(' → ')}
                </div>
              )}
            </div>

            {/* Employee Table */}
            <Table>
              <TableHeader>
                <TableRow className="print:bg-gray-50">
                  <TableHead className="text-[10px] w-8 print:text-[8pt] print:py-1 print:px-2">#</TableHead>
                  <TableHead className="text-[10px] print:text-[8pt] print:py-1 print:px-2">Emp No</TableHead>
                  <TableHead className="text-[10px] print:text-[8pt] print:py-1 print:px-2">Employee</TableHead>
                  <TableHead className="text-[10px] print:text-[8pt] print:py-1 print:px-2">Drop-Off Location</TableHead>
                  <TableHead className="text-[10px] w-20 print:text-[8pt] print:py-1 print:px-2">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.employees
                  .sort((a, b) => (a.stopSequence ?? 99) - (b.stopSequence ?? 99))
                  .map((emp, i) => (
                  <TableRow key={emp.employeeNo || `${emp.employeeName}-${i}`} className="print:border-gray-200">
                    <TableCell className="text-[10px] text-muted-foreground print:text-gray-500 print:py-0.5 print:px-2 font-mono">
                      {i + 1}
                    </TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground print:text-gray-600 print:py-0.5 print:px-2">
                      {emp.employeeNo || '—'}
                    </TableCell>
                    <TableCell className="text-[11px] font-medium text-foreground print:text-black print:py-0.5 print:px-2">
                      {emp.employeeName}
                    </TableCell>
                    <TableCell className="text-[11px] text-foreground print:text-black print:py-0.5 print:px-2">
                      {emp.destination || 'Unnamed Drop Point'}
                    </TableCell>
                    <TableCell className="print:py-0.5 print:px-2">
                      <span className="inline-block rounded-full bg-[hsl(var(--success))]/10 px-2 py-0.5 text-[9px] font-semibold text-[hsl(var(--success))] print:bg-transparent print:text-gray-700 print:border print:border-gray-300 print:px-1.5">
                        {emp.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Group Footer */}
            <div className="px-4 py-1.5 bg-muted/30 text-[10px] text-muted-foreground print:bg-gray-50 print:text-gray-500 print:px-3 flex items-center justify-between">
              <span>{group.employees.length} employee{group.employees.length !== 1 ? 's' : ''}</span>
              <span>{group.stops.length} stop{group.stops.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}

        {/* Report Summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3 print:text-gray-500 print:border-gray-300 print:pt-2">
          <span>Total: {data.length} employees · {routeGroups.length} route{routeGroups.length !== 1 ? 's' : ''}</span>
          <span>{meta.requestDate}</span>
        </div>
      </div>
    </PrintableReportLayout>
  );
}
