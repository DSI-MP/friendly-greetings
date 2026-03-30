import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, X, Loader2 } from 'lucide-react';

interface Props {
  onApprove: (note?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  approveLabel?: string;
  rejectLabel?: string;
  requireRejectReason?: boolean;
  disabled?: boolean;
  extraActions?: React.ReactNode;
}

export default function ApprovalActionBar({
  onApprove, onReject, approveLabel = 'Approve', rejectLabel = 'Reject',
  requireRejectReason = true, disabled, extraActions,
}: Props) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    setLoading('approve');
    try { await onApprove(); } finally { setLoading(null); }
  };

  const handleReject = async () => {
    if (requireRejectReason && !reason.trim()) return;
    setLoading('reject');
    try {
      await onReject(reason);
      setShowReject(false);
      setReason('');
    } finally { setLoading(null); }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {extraActions}
        <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={() => setShowReject(true)} disabled={disabled || loading !== null}>
          <X className="mr-1.5 h-4 w-4" />{rejectLabel}
        </Button>
        <Button onClick={handleApprove} disabled={disabled || loading !== null}
          className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-[hsl(var(--success-foreground))]">
          {loading === 'approve' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
          {approveLabel}
        </Button>
      </div>

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejection Reason</DialogTitle></DialogHeader>
          <Textarea placeholder="Provide a reason for rejection…" value={reason}
            onChange={e => setReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}
              disabled={requireRejectReason && !reason.trim() || loading === 'reject'}>
              {loading === 'reject' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
