import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkflowApi } from '@/hooks/useWorkflowApi';
import RequestSummaryCard from '@/components/workflow/RequestSummaryCard';
import ApprovalActionBar from '@/components/workflow/ApprovalActionBar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import WorkflowTimelinePanel from '@/components/workflow/WorkflowTimelinePanel';
import EmployeeSelectionTable from '@/components/workflow/EmployeeSelectionTable';
import StatusBadge from '@/components/transport/StatusBadge';
import { CheckCircle, XCircle, Clock, Lock, Search } from 'lucide-react';
import type { RequestDetail } from '@/types/workflow';

export default function AdminApprovalsPage() {
  const navigate = useNavigate();
  const api = useWorkflowApi();
  const [requests, setRequests] = useState<RequestDetail[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RequestDetail | null>(null);

  const load = () => {
    setPageLoading(true);
    api.fetchRequests().then(r => { setRequests(r); setPageLoading(false); });
  };
  useEffect(load, [api.fetchRequests]);

  const pending = requests.filter(r => r.status === 'SUBMITTED');
  const approved = requests.filter(r => r.status === 'ADMIN_APPROVED');
  const locked = requests.filter(r => r.status === 'DAILY_LOCKED');
  const rejected = requests.filter(r => r.status === 'ADMIN_REJECTED');

  const tabData: Record<string, RequestDetail[]> = { pending, approved, locked, rejected, all: requests };
  const filtered = (tabData[tab] || requests).filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.department_name || '').toLowerCase().includes(q) ||
      String(r.id).includes(q) || (r.notes || '').toLowerCase().includes(q);
  });

  const handleApprove = async (req: RequestDetail) => {
    await api.adminApprove(req.id);
    load(); setSelected(null);
  };
  const handleReject = async (req: RequestDetail, reason: string) => {
    await api.adminReject(req.id, reason);
    load(); setSelected(null);
  };
  const handleLock = async (req: RequestDetail) => {
    const requestDate = typeof req.request_date === 'string'
      ? req.request_date.split('T')[0]
      : new Date(req.request_date).toISOString().split('T')[0];

    await api.lockDailyRun(requestDate);
    load(); setSelected(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review, approve, and manage drop-off transport requests
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending Review', count: pending.length, icon: Clock, color: 'text-[hsl(var(--warning))]' },
          { label: 'Approved', count: approved.length, icon: CheckCircle, color: 'text-[hsl(var(--success))]' },
          { label: 'Locked', count: locked.length, icon: Lock, color: 'text-primary' },
          { label: 'Rejected', count: rejected.length, icon: XCircle, color: 'text-destructive' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search requests…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="locked">Locked ({locked.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {pageLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <p className="font-medium text-foreground">No requests</p>
              <p className="text-sm text-muted-foreground mt-1">No drop-off requests match this filter.</p>
            </CardContent></Card>
          ) : filtered.map(req => (
            <div key={req.id} className="relative">
              <RequestSummaryCard request={req} onClick={() => setSelected(req)} />
              {req.status === 'SUBMITTED' && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-destructive/30 text-destructive"
                    onClick={e => { e.stopPropagation(); setSelected(req); }}>Review</Button>
                </div>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <div className="space-y-5 pt-2">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  REQ-{String(selected.id).padStart(4, '0')} <StatusBadge status={selected.status} />
                </SheetTitle>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Drop-Off Date</span><p className="font-medium">{selected.request_date}</p></div>
                <div><span className="text-muted-foreground text-xs">Department</span><p className="font-medium">{selected.department_name}</p></div>
                <div><span className="text-muted-foreground text-xs">Employees</span><p className="font-medium">{selected.employee_count ?? selected.employees?.length ?? 0}</p></div>
                <div><span className="text-muted-foreground text-xs">Created By</span><p className="font-medium">{selected.created_by_name}</p></div>
              </div>

              {selected.notes && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selected.notes}</p>
                </div>
              )}

              {selected.rejection_reason && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive">Rejection Reason</p>
                  <p className="text-sm mt-0.5">{selected.rejection_reason}</p>
                </div>
              )}

              {selected.employees && selected.employees.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Employees (Drop-Off Destinations)</p>
                  <EmployeeSelectionTable employees={selected.employees} selected={selected.employees.map(e => e.id)} onChange={() => {}} readOnly />
                </div>
              )}

              <WorkflowTimelinePanel currentStatus={selected.status} statusHistory={selected.status_history} compact />

              {selected.status === 'SUBMITTED' && (
                <ApprovalActionBar
                  onApprove={() => handleApprove(selected)}
                  onReject={(reason) => handleReject(selected, reason)}
                  approveLabel="Approve Drop-Off Request" rejectLabel="Reject Request"
                />
              )}
              {selected.status === 'ADMIN_APPROVED' && (
                <Button
                  onClick={() => handleLock(selected)}
                  disabled={api.loading}
                  className="w-full bg-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.9)] text-[hsl(var(--warning-foreground))]"
                >
                  <Lock className="mr-1.5 h-4 w-4" />Lock Daily Run
                </Button>
              )}

              <Button variant="outline" className="w-full" onClick={() => { navigate(`/requests/${selected.id}`); setSelected(null); }}>
                View Full Details
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
