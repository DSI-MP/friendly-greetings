import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useWorkflowApi } from '@/hooks/useWorkflowApi';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateRequestDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const { createRequest, loading } = useWorkflowApi();
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [otTime, setOtTime] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;

    try {
      await createRequest({
        requestDate: date,
        notes: notes.trim() || undefined,
        otTime: otTime || undefined,
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
            <Button type="submit" disabled={loading || !date}>
              {loading ? 'Creating...' : 'Create Draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
