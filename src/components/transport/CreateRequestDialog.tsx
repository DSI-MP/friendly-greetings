import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkflowApi } from '@/hooks/useWorkflowApi';
import { useDailyLock } from '@/hooks/useDailyLock';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert } from 'lucide-react';
import api from '@/lib/api';

interface Department { id: number; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateRequestDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { createRequest, loading } = useWorkflowApi();
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [otTime, setOtTime] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  // Daily lock check for selected date
  const { isLocked, loading: lockLoading } = useDailyLock(date || undefined);

  // Load departments for admin users
  useEffect(() => {
    if (!open || !isAdmin) return;
    (async () => {
      setDeptsLoading(true);
      try {
        const res = await api.get('/departments', { params: { limit: 200 } });
        const d = res.data?.data ?? res.data;
        const items = d?.items || d || [];
        setDepartments(Array.isArray(items) ? items : []);
      } catch {
        setDepartments([]);
      } finally {
        setDeptsLoading(false);
      }
    })();
  }, [open, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;

    if (isAdmin && !departmentId) {
      toast({ title: 'Validation', description: 'Please select a department.', variant: 'destructive' });
      return;
    }

    if (isLocked) {
      toast({
        title: 'Date Locked',
        description: `The daily run for ${date} is locked. Cannot create requests for this date.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      await createRequest({
        requestDate: date,
        notes: notes.trim() || undefined,
        otTime: otTime || undefined,
        departmentId: isAdmin ? Number(departmentId) : undefined,
      });
      toast({
        title: 'Drop-off request created',
        description: 'Saved as draft. Add employees and submit for approval.',
      });
      onCreated();
      onOpenChange(false);
      setDate('');
      setNotes('');
      setOtTime('');
      setDepartmentId('');
    } catch {
      // Error toast handled by useWorkflowApi
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Drop-Off Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="req-dept">Department *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="req-dept">
                  <SelectValue placeholder={deptsLoading ? 'Loading…' : 'Select department'} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="req-date">Drop-Off Date</Label>
            <Input
              id="req-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          {/* Daily lock warning */}
          {date && !lockLoading && isLocked && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
              <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">
                The daily run for {date} is locked. You cannot create requests for this date.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="req-ot">OT Time (optional)</Label>
            <Input
              id="req-ot"
              type="time"
              value={otTime}
              onChange={e => setOtTime(e.target.value)}
              placeholder="e.g. 18:00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-notes">Notes (optional)</Label>
            <Textarea
              id="req-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any special instructions for the drop-off run..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !date || isLocked || (isAdmin && !departmentId)}>
              {loading ? 'Creating...' : 'Create Draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
