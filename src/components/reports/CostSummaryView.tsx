import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PrintableReportLayout from './PrintableReportLayout';
import type { CostSummaryRow, ReportMeta } from '@/types/reports';

interface Props { data: CostSummaryRow[]; meta: ReportMeta }

function fmt(n: number) {
  return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(n);
}

export default function CostSummaryView({ data, meta }: Props) {
  if (!data || data.length === 0) {
    return (
      <PrintableReportLayout meta={{ ...meta, title: 'Cost Summary Report (Cost per KM)' }}>
        <p className="py-8 text-center text-sm text-muted-foreground">No cost data available for the selected date.</p>
      </PrintableReportLayout>
    );
  }

  const costPerKm = (data[0] as any)?.costPerKm || 50;
  const totalCost = data.reduce((s, r) => s + (r.estimatedCost || 0), 0);
  const totalDist = data.reduce((s, r) => s + (r.estimatedDistanceKm || 0), 0);
  const totalEmp = data.reduce((s, r) => s + (r.employeeCount || 0), 0);

  return (
    <PrintableReportLayout meta={{ ...meta, title: 'Cost Summary Report (Cost per KM)' }}>
      <div className="mb-4 rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Cost Model:</span> Route cost = Distance (km) × <strong>{fmt(costPerKm)}/km</strong>.
        The cost-per-km rate is configurable in System Settings → <code className="bg-muted px-1 rounded">cost_per_km</code>.
        All figures are <em>estimates</em> based on calculated route distances.
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Route / Group</TableHead>
            <TableHead className="text-xs text-right">Distance (km)</TableHead>
            <TableHead className="text-xs text-right">Rate (per km)</TableHead>
            <TableHead className="text-xs text-right">Employees</TableHead>
            <TableHead className="text-xs text-right">Est. Route Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="text-xs font-medium">{r.routeGroup}</TableCell>
              <TableCell className="text-xs text-right">{r.estimatedDistanceKm?.toFixed(1) || '0'}</TableCell>
              <TableCell className="text-xs text-right">{fmt(costPerKm)}</TableCell>
              <TableCell className="text-xs text-right">{r.employeeCount || 0}</TableCell>
              <TableCell className="text-xs text-right font-semibold">{fmt(r.estimatedCost || 0)}</TableCell>
            </TableRow>
          ))}
          {/* Totals row */}
          <TableRow className="border-t-2 border-foreground/20">
            <TableCell className="text-xs font-bold">TOTAL</TableCell>
            <TableCell className="text-xs text-right font-bold">{totalDist.toFixed(1)}</TableCell>
            <TableCell className="text-xs text-right font-bold">{fmt(costPerKm)}</TableCell>
            <TableCell className="text-xs text-right font-bold">{totalEmp}</TableCell>
            <TableCell className="text-xs text-right font-bold">{fmt(totalCost)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </PrintableReportLayout>
  );
}
