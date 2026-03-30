import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkflowApi } from '@/hooks/useWorkflowApi';
import RequestSummaryCard from '@/components/workflow/RequestSummaryCard';
import ApprovalActionBar from '@/components/workflow/ApprovalActionBar';
import WorkflowTimelinePanel from '@/components/workflow/WorkflowTimelinePanel';
import EmployeeSelectionTable from '@/components/workflow/EmployeeSelectionTable';
import StatusBadge from '@/components/transport/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, Clock, XCircle, FileCheck, Truck } from 'lucide-react';
import type { RequestDetail } from '@/types/workflow';

export default function HrFinalApprovalsPage() {
  const navigate = useNavigate();
  const api = useWorkflowApi();
  const [requests, setRequests] = useState<RequestDetail[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [selected, setSelected] = useState<RequestDetail | null>(null);
  const [tab, setTab] = useState('pending');

  const load = async () => {
    setPageLoading(true);
    try {
      // Fetch only HR-relevant statuses instead of all requests
      const [pending, done, rejected] = await Promise.all([
        api.fetchRequests({ status: 'TA_COMPLETED' as any }),
        api.fetchRequests({ status: 'HR_APPROVED' as any }),
        api.fetchRequests({ status: 'HR_REJECTED' as any }),
      ]);
      setRequests([...pending, ...done, ...rejected]);
    } catch {
      // Error already toasted by useWorkflowApi
    } finally {
      setPageLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const pending = requests.filter(r => r.status === 'TA_COMPLETED');
  const approved = requests.filter(r => r.status === 'HR_APPROVED');
  const rejected = requests.filter(r => r.status === 'HR_REJECTED');

  const tabData: Record<string, RequestDetail[]> = { pending, approved, rejected, all: requests };
  const list = tabData[tab] || requests;

  const handleApprove = async (req: RequestDetail) => {
    await api.hrApprove(req.id);
    load(); setSelected(null);
  };
  const handleReject = async (req: RequestDetail, reason: string) => {
    await api.hrReject(req.id, reason);
    load(); setSelected(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">HR Final Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve completed drop-off assignment plans
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-[hsl(var(--warning))]" />
          <div><p className="text-2xl font-bold text-foreground">{pending.length}</p><p className="text-xs text-muted-foreground">Pending</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <CheckCircle className="h-8 w-8 text-[hsl(var(--success))]" />
          <div><p className="text-2xl font-bold text-foreground">{approved.length}</p><p className="text-xs text-muted-foreground">Approved</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <XCircle className="h-8 w-8 text-destructive" />
          <div><p className="text-2xl font-bold text-foreground">{rejected.length}</p><p className="text-xs text-muted-foreground">Rejected</p></div>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {pageLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : list.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <FileCheck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-medium text-foreground">No drop-off plans to review</p>
            </CardContent></Card>
          ) : list.map(req => (
            <RequestSummaryCard key={req.id} request={req} onClick={() => setSelected(req)} />
          ))}
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
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
                <div><span className="text-muted-foreground text-xs">Employees</span><p className="font-medium">{selected.employee_count ?? 0}</p></div>
                <div><span className="text-muted-foreground text-xs">Created By</span><p className="font-medium">{selected.created_by_name}</p></div>
              </div>

              {selected.notes && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selected.notes}</p>
                </div>
              )}

              {/* Groups summary */}
              {selected.groups && selected.groups.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Truck className="h-4 w-4" />Drop-Off Assignment Summary
                  </p>
                  <div className="space-y-2">
                    {selected.groups.map(g => (
                      <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                        <div>
                          <span className="font-medium">{g.group_code}</span>
                          <span className="text-muted-foreground ml-2">· {g.employee_count} emp</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline">{g.assigned_vehicle_reg || 'No vehicle'}</Badge>
                          <span>{g.driver_name || 'No driver'}</span>
                          {(g.overflow_count ?? 0) > 0 && <Badge variant="destructive">Overflow</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <WorkflowTimelinePanel currentStatus={selected.status} statusHistory={selected.status_history} compact />

              {selected.status === 'TA_COMPLETED' && (
                <ApprovalActionBar
                  onApprove={() => handleApprove(selected)}
                  onReject={(reason) => handleReject(selected, reason)}
                  approveLabel="HR Approve Drop-Off Plan" rejectLabel="HR Reject"
                />
              )}

              {selected.status === 'HR_APPROVED' && (
                <div className="p-4 rounded-lg bg-[hsl(var(--success)/0.1)] border border-[hsl(var(--success)/0.2)] text-center">
                  <CheckCircle className="h-8 w-8 mx-auto text-[hsl(var(--success))] mb-2" />
                  <p className="font-medium text-[hsl(var(--success))]">Final Approval Granted</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Drop-off plan is now active. Employee transport details have been published.
                  </p>
                </div>
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
