import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import type { ReportFilters } from '@/types/reports';

interface Props {
  filters: ReportFilters;
  onChange: (f: ReportFilters) => void;
  onReset: () => void;
}

export default function ReportFiltersBar({ filters, onChange, onReset }: Props) {
  const update = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div>
          <Label className="text-xs text-muted-foreground">Report Date</Label>
          <Input type="date" value={filters.date || ''} onChange={e => update({ date: e.target.value })} className="mt-1" />
        </div>
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5 w-full">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}