import { Card, CardContent } from '@/components/ui/card';
import type { ReportType } from '@/types/reports';
import { Route, Truck, Building2, Layers, FileText, DollarSign, AlertTriangle, Archive } from 'lucide-react';

const TYPES: { id: ReportType; label: string; desc: string; icon: typeof Route }[] = [
  { id: 'route-wise', label: 'Route-Wise', desc: 'Employee assignments by route corridor', icon: Route },
  { id: 'vehicle-wise', label: 'Vehicle-Wise', desc: 'Vehicle assignments and occupancy', icon: Truck },
  { id: 'department-summary', label: 'Department Summary', desc: 'Department-level request overview', icon: Building2 },
  { id: 'grouping', label: 'Grouping Report', desc: 'Operational grouping details', icon: Layers },
  { id: 'dispatch-manifest', label: 'Dispatch Manifest', desc: 'Final driver dispatch sheet', icon: FileText },
  { id: 'cost-summary', label: 'Cost Summary', desc: 'Route cost and utilization', icon: DollarSign },
  { id: 'exception', label: 'Exception Report', desc: 'Warnings, overflows, unresolved', icon: AlertTriangle },
  { id: 'archive', label: 'Archive / History', desc: 'Closed and archived reports', icon: Archive },
];

interface Props {
  selected: ReportType;
  onChange: (t: ReportType) => void;
  allowedTypes?: ReportType[];
}

export default function ReportTypeSelector({ selected, onChange, allowedTypes }: Props) {
  // Bug fix #2: Only show cards the user is allowed to access
  const visibleTypes = allowedTypes ? TYPES.filter(t => allowedTypes.includes(t.id)) : TYPES;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {visibleTypes.map(t => {
        const active = selected === t.id;
        return (
          <Card
            key={t.id}
            className={`cursor-pointer transition-all ${active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'hover:border-primary/40 hover:bg-muted/50'}`}
            onClick={() => onChange(t.id)}
          >
            <CardContent className="flex flex-col items-center gap-1.5 p-3 text-center">
              <t.icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-xs font-semibold leading-tight ${active ? 'text-primary' : 'text-foreground'}`}>{t.label}</span>
              <span className="text-[10px] leading-tight text-muted-foreground hidden sm:block">{t.desc}</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
