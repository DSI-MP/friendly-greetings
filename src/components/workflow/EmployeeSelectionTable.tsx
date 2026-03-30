import { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, MapPin, AlertTriangle, Pencil } from 'lucide-react';
import LocationEditDialog, { type PlaceOption } from './LocationEditDialog';
import type { WorkflowEmployee } from '@/lib/mockWorkflowData';

interface Props {
  employees: WorkflowEmployee[];
  selected: number[];
  onChange: (ids: number[]) => void;
  readOnly?: boolean;
  places?: PlaceOption[];
  placesLoading?: boolean;
  onLocationUpdate?: (employeeId: number, place: PlaceOption) => Promise<void>;
}

export default function EmployeeSelectionTable({ employees, selected, onChange, readOnly, places, placesLoading, onLocationUpdate }: Props) {
  const [search, setSearch] = useState('');
  const [editEmp, setEditEmp] = useState<WorkflowEmployee | null>(null);

  const filtered = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      e.full_name.toLowerCase().includes(q) || e.emp_no.toLowerCase().includes(q) ||
      (e.destination_location || '').toLowerCase().includes(q)
    );
  }, [employees, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selected.includes(e.id));

  const toggleAll = () => {
    if (readOnly) return;
    if (allFilteredSelected) {
      onChange(selected.filter(id => !filtered.find(e => e.id === id)));
    } else {
      const newIds = new Set([...selected, ...filtered.map(e => e.id)]);
      onChange(Array.from(newIds));
    }
  };

  const toggle = (id: number) => {
    if (readOnly) return;
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const resolvedCount = employees.filter(e => e.location_resolved).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{selected.length} selected</Badge>
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" />{resolvedCount}/{employees.length} destinations
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border overflow-auto max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              {!readOnly && (
                <TableHead className="w-10">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} />
                </TableHead>
              )}
              <TableHead>Emp No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={readOnly ? 4 : 5} className="text-center text-muted-foreground py-8">No employees found</TableCell></TableRow>
            ) : filtered.map(emp => (
              <TableRow key={emp.id} className={selected.includes(emp.id) ? 'bg-accent/40' : ''}>
                {!readOnly && (
                  <TableCell>
                    <Checkbox checked={selected.includes(emp.id)} onCheckedChange={() => toggle(emp.id)} />
                  </TableCell>
                )}
                <TableCell className="text-sm font-medium">{emp.emp_no}</TableCell>
                <TableCell className="text-sm">{emp.full_name}</TableCell>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-1.5">
                    {emp.location_resolved ? (
                      <span className="flex items-center gap-1 text-[hsl(var(--success))]">
                        <MapPin className="h-3.5 w-3.5" />{emp.destination_location}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[hsl(var(--warning))]">
                        <AlertTriangle className="h-3.5 w-3.5" />Unresolved
                      </span>
                    )}
                    {!readOnly && onLocationUpdate && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={e => { e.stopPropagation(); setEditEmp(emp); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{emp.phone || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editEmp && onLocationUpdate && (
        <LocationEditDialog
          open={!!editEmp}
          onClose={() => setEditEmp(null)}
          employeeName={editEmp.full_name}
          currentLocation={editEmp.destination_location}
          places={places || []}
          placesLoading={placesLoading || false}
          onSave={async (place) => {
            await onLocationUpdate(editEmp.id, place);
          }}
        />
      )}
    </div>
  );
}
