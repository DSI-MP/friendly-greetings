import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkflowApi } from '@/hooks/useWorkflowApi';
import { useAuth } from '@/context/AuthContext';
import ApprovalActionBar from '@/components/workflow/ApprovalActionBar';
import WorkflowTimelinePanel from '@/components/workflow/WorkflowTimelinePanel';
import StatusBadge from '@/components/transport/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, Clock, XCircle, FileCheck, Truck, Calendar, Building2, Users, ChevronDown, Download } from 'lucide-react';
import { formatRequestId } from '@/lib/formatRequestId';
import type { RequestDetail } from '@/types/workflow';
import api from '@/lib/api';

/** Consolidated request: one per date/run, with departments nested inside */
interface ConsolidatedRequest {
  date: string;
  displayId: string;
  status: string;
  departments: {
    id: number;
    name: string;
    employeeCount: number;
    requestIds: number[];
    groups: any[];
  }[];
  totalEmployees: number;
  totalDepartments: number;
  requests: RequestDetail[];
}

function consolidateByDate(requests: RequestDetail[]): ConsolidatedRequest[] {
  const byDate = new Map<string, RequestDetail[]>();
  for (const r of requests) {
    const date = r.request_date || 'unknown';
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(r);
  }

  const consolidated: ConsolidatedRequest[] = [];
  let seqId = 1;

  const sortedDates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));
  for (const date of sortedDates) {
    const dateRequests = byDate.get(date)!;
    const deptMap = new Map<number, { name: string; employeeCount: number; requestIds: number[]; groups: any[] }>();

    for (const r of dateRequests) {
      const deptId = r.department_id;
      const deptName = r.department_name || r.department?.name || `Dept ${deptId}`;
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, { name: deptName, employeeCount: 0, requestIds: [], groups: [] });
      }
      const entry = deptMap.get(deptId)!;
      entry.employeeCount += r.employee_count ?? r.employees?.length ?? 0;
      entry.requestIds.push(r.id);
      if (r.groups) entry.groups.push(...r.groups);
    }

    // Use primary status from first request
    const primaryStatus = dateRequests[0]?.status || 'UNKNOWN';

    consolidated.push({
      date,
      displayId: formatRequestId(seqId),
      status: primaryStatus,
      departments: Array.from(deptMap.entries()).map(([id, d]) => ({ id, ...d })),
      totalEmployees: Array.from(deptMap.values()).reduce((s, d) => s + d.employeeCount, 0),
      totalDepartments: deptMap.size,
      requests: dateRequests,
    });
    seqId++;
  }

  return consolidated;
}

export default function HrFinalApprovalsPage() {
  const navigate = useNavigate();
  const workflowApi = useWorkflowApi();
  const { user } = useAuth();
  const [requests, setRequests] = useState<RequestDetail[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [selected, setSelected] = useState<ConsolidatedRequest | null>(null);
  const [tab, setTab] = useState('pending');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setPageLoading(true);
    try {
      const [pending, done, rejected] = await Promise.all([
        workflowApi.fetchRequests({ status: 'TA_COMPLETED' as any }),
        workflowApi.fetchRequests({ status: 'HR_APPROVED' as any }),
        workflowApi.fetchRequests({ status: 'HR_REJECTED' as any }),
      ]);
      setRequests([...pending, ...done, ...rejected]);
    } catch {
      // Error already toasted
    } finally {
      setPageLoading(false);
    }
  }, [workflowApi]);

  useEffect(() => { load(); }, []);

  const allConsolidated = consolidateByDate(requests);
  const pending = allConsolidated.filter(c => c.status === 'TA_COMPLETED');
  const approved = allConsolidated.filter(c => c.status === 'HR_APPROVED');
  const rejected = allConsolidated.filter(c => c.status === 'HR_REJECTED');

  const tabData: Record<string, ConsolidatedRequest[]> = { pending, approved, rejected, all: allConsolidated };
  const list = tabData[tab] || allConsolidated;

  const handleApproveAll = async (consolidated: ConsolidatedRequest) => {
    for (const req of consolidated.requests) {
      if (req.status === 'TA_COMPLETED') {
        await workflowApi.hrApprove(req.id);
      }
    }
    load();
    setSelected(null);
  };

  const handleRejectAll = async (consolidated: ConsolidatedRequest, reason: string) => {
    for (const req of consolidated.requests) {
      if (req.status === 'TA_COMPLETED') {
        await workflowApi.hrReject(req.id, reason);
      }
    }
    load();
    setSelected(null);
  };

  // ── Excel export (HR only) ──
  const handleExportExcel = async () => {
    if (user?.role !== 'HR') return;
    setExporting(true);
    try {
      const res = await api.get('/reports/route-wise', {
        params: { date: new Date().toISOString().split('T')[0] },
      });
      const data = res.data?.data ?? res.data;
      const rows = data?.rows || [];

      // Dynamic import xlsx
      const XLSX = await import('xlsx');
      const wsData = rows.map((r: any, i: number) => ({
        '#': i + 1,
        'Request ID': formatRequestId(i + 1),
        'Date': r.requestDate || '',
        'Department': r.departmentName || '',
        'Employee No': r.employeeNo || '',
        'Employee Name': r.employeeName || '',
        'Route': r.routeName || '',
        'Vehicle': r.vehicleReg || '',
        'Driver': r.driverName || '',
        'Status': r.status || '',
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'HR Report');
      XLSX.writeFile(wb, `hr_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch {
      // Silently fail
    } finally {
      setExporting(false);
    }
  };

  // ── PDF export (HR only) ──
  const handleExportPdf = () => {
    if (user?.role !== 'HR') return;
    // Open reports page in print mode
    window.open('/reports?type=route-wise&print=1', '_blank');
  };

  const isHR = user?.role === 'HR';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">HR Final Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve consolidated drop-off plans per date
          </p>
        </div>
        {isHR && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting} className="gap-1.5">
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1.5">
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        )}
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
          ) : list.map(consolidated => (
            <Card
              key={consolidated.date}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelected(consolidated)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{consolidated.displayId}</span>
                      <StatusBadge status={consolidated.status as any} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{consolidated.date}</span>
                      <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{consolidated.totalDepartments} department(s)</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{consolidated.totalEmployees} employees</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {consolidated.departments.map(d => (
                        <Badge key={d.id} variant="outline" className="text-[10px]">{d.name} ({d.employeeCount})</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <div className="space-y-5 pt-2">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.displayId} <StatusBadge status={selected.status as any} />
                </SheetTitle>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Date</span><p className="font-medium">{selected.date}</p></div>
                <div><span className="text-muted-foreground text-xs">Departments</span><p className="font-medium">{selected.totalDepartments}</p></div>
                <div><span className="text-muted-foreground text-xs">Total Employees</span><p className="font-medium">{selected.totalEmployees}</p></div>
                <div><span className="text-muted-foreground text-xs">Requests</span><p className="font-medium">{selected.requests.length}</p></div>
              </div>

              {/* Department breakdown */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1">
                  <Building2 className="h-4 w-4" /> Department Breakdown
                </p>
                {selected.departments.map(dept => (
                  <Collapsible key={dept.id}>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{dept.name}</span>
                        <Badge variant="outline" className="text-xs">{dept.employeeCount} emp</Badge>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-2">
                      {dept.groups.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {dept.groups.map((g: any) => (
                            <div key={g.id} className="flex items-center justify-between p-2 rounded border text-xs">
                              <span className="font-medium">{g.group_code} · {g.employee_count} emp</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{g.assigned_vehicle_reg || 'No vehicle'}</Badge>
                                <span>{g.driver_name || '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-2">No group details available</p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>

              {selected.requests[0] && (
                <WorkflowTimelinePanel
                  currentStatus={selected.requests[0].status}
                  statusHistory={selected.requests[0].status_history}
                  compact
                />
              )}

              {selected.status === 'TA_COMPLETED' && (
                <ApprovalActionBar
                  onApprove={() => handleApproveAll(selected)}
                  onReject={(reason) => handleRejectAll(selected, reason)}
                  approveLabel="HR Approve All Departments"
                  rejectLabel="HR Reject"
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

              <Button variant="outline" className="w-full" onClick={() => { navigate(`/requests/${selected.requests[0]?.id}`); setSelected(null); }}>
                View Full Details
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
