import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useWorkflowApi } from '@/hooks/useWorkflowApi';
import { useDailyLock } from '@/hooks/useDailyLock';
import WorkflowTimelinePanel from '@/components/workflow/WorkflowTimelinePanel';
import RequestStatusHistoryPanel from '@/components/workflow/RequestStatusHistoryPanel';
import EmployeeSelectionTable from '@/components/workflow/EmployeeSelectionTable';
import ApprovalActionBar from '@/components/workflow/ApprovalActionBar';
import CapacityWarningBanner from '@/components/workflow/CapacityWarningBanner';
import StatusBadge from '@/components/transport/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Calendar, Building2, Users, FileText, Send, Lock,
  Loader2, UserMinus, ShieldAlert, Pencil, Clock,
} from 'lucide-react';
import type { RequestDetail } from '@/types/workflow';
import type { PlaceOption } from '@/components/workflow/LocationEditDialog';

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const api = useWorkflowApi();
  const [req, setReq] = useState<RequestDetail | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const role = user?.role;
  const requestDate = req?.request_date;
  const { isLocked, loading: lockLoading } = useDailyLock(requestDate);

  const isEditableStatus = req?.status === 'DRAFT' || req?.status === 'SUBMITTED';
  const canHodEdit = role === 'HOD' && isEditableStatus && !isLocked;

  useEffect(() => {
    if (!id) return;
    setPageLoading(true);
    api.fetchRequestById(Number(id)).then(r => {
      setReq(r);
      setSelectedEmpIds(r?.employees?.map(e => e.id) ?? []);
      setPageLoading(false);
    });
  }, [id, api.fetchRequestById]);

  useEffect(() => {
    if (canHodEdit) {
      setPlacesLoading(true);
      api.fetchPlaces().then(p => {
        setPlaces(p.map(pl => ({
          id: pl.id, title: pl.title, address: pl.address,
          latitude: pl.latitude, longitude: pl.longitude,
        })));
        setPlacesLoading(false);
      });
    }
  }, [canHodEdit, api.fetchPlaces]);

  const refresh = () => {
    if (id)
      api.fetchRequestById(Number(id)).then(r => {
        setReq(r);
        setSelectedEmpIds(r?.employees?.map(e => e.id) ?? []);
      });
  };

  const handleRemoveSelected = async () => {
    if (!req) return;
    const toRemove = req.employees?.filter(e => selectedEmpIds.includes(e.id)).map(e => e.id) ?? [];
    if (toRemove.length === 0) return;

    setRemoving(true);
    try {
      const keepIds = req.employees?.filter(e => !selectedEmpIds.includes(e.id)).map(e => e.id) ?? [];
      await api.addEmployees(req.id, keepIds);
      refresh();
    } finally {
      setRemoving(false);
      setSelectedEmpIds([]);
    }
  };

  const handleLocationUpdate = async (employeeId: number, place: PlaceOption) => {
    await api.updateEmployeeLocation(employeeId, place.id, place.latitude, place.longitude);
    refresh();
  };

  if (pageLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!req) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-medium text-foreground">Request not found</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const unresolvedCount = req.employees?.filter(e => !e.location_resolved).length ?? 0;
  const overflowGroups = req.groups?.filter(g => (g.overflow_count ?? 0) > 0).length ?? 0;
  const canSubmitHod = role === 'HOD' && req.status === 'DRAFT' && !isLocked;
  const canAdminReview = (role === 'ADMIN' || role === 'SUPER_ADMIN') && req.status === 'SUBMITTED';
  const canLock = (role === 'ADMIN' || role === 'SUPER_ADMIN') && req.status === 'ADMIN_APPROVED';
  const canHrReview = (role === 'HR' || role === 'SUPER_ADMIN') && req.status === 'TA_COMPLETED';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">REQ-{String(req.id).padStart(4, '0')}</h1>
            <StatusBadge status={req.status} />
            {canHodEdit && (
              <Button
                variant="outline"
                size="sm"
                className="text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)] gap-1"
                onClick={() => navigate(`/requests/${req.id}/edit`)}
              >
                <Pencil className="h-3 w-3" />Edit
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {req.department_name} · Created by {req.created_by_name}
          </p>
        </div>
      </div>

      {/* Daily Lock Warning */}
      {role === 'HOD' && isEditableStatus && !lockLoading && isLocked && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <ShieldAlert className="h-6 w-6 text-destructive shrink-0" />
            <div>
              <p className="font-semibold text-destructive text-sm">Daily Run is Locked</p>
              <p className="text-xs text-muted-foreground">
                The administrator has locked this day's run. You cannot edit employees or locations until it is unlocked.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <CapacityWarningBanner unresolvedCount={unresolvedCount} overflowGroups={overflowGroups} totalGroups={req.groups?.length ?? 0} />

      {/* Action bars */}
      {canSubmitHod && (
        <Card><CardContent className="p-4 flex justify-end">
          <Button onClick={async () => { await api.submitRequest(req.id); refresh(); }}>
            <Send className="mr-1.5 h-4 w-4" />Submit for Approval
          </Button>
        </CardContent></Card>
      )}
      {canAdminReview && (
        <Card><CardContent className="p-4 flex justify-end">
          <ApprovalActionBar
            onApprove={async () => { await api.adminApprove(req.id); refresh(); }}
            onReject={async (reason) => { await api.adminReject(req.id, reason); refresh(); }}
            approveLabel="Admin Approve" rejectLabel="Admin Reject"
          />
        </CardContent></Card>
      )}
      {canLock && (
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-2">
            To lock this date's daily run, use the <strong>Admin Daily Lock</strong> page. It will lock ALL approved requests for this date at once.
          </p>
          <Button variant="outline" onClick={() => navigate('/admin/approvals')}>
            <Lock className="mr-1.5 h-4 w-4" />Go to Daily Lock
          </Button>
        </CardContent></Card>
      )}
      {canHrReview && (
        <Card><CardContent className="p-4 flex justify-end">
          <ApprovalActionBar
            onApprove={async () => { await api.hrApprove(req.id); refresh(); }}
            onReject={async (reason) => { await api.hrReject(req.id, reason); refresh(); }}
            approveLabel="HR Approve" rejectLabel="HR Reject"
          />
        </CardContent></Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Info card */}
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{req.request_date}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="text-sm font-medium flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{req.department_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Employees</p>
                  <p className="text-sm font-medium flex items-center gap-1"><Users className="h-3.5 w-3.5" />{req.employee_count ?? req.employees?.length ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">OT Time</p>
                  <p className="text-sm font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{req.ot_time || '—'}</p>
                </div>
              </div>
              {req.notes && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{req.notes}</p>
                </div>
              )}
              {req.rejection_reason && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive">Rejection Reason</p>
                  <p className="text-sm text-foreground mt-0.5">{req.rejection_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="employees">
            <TabsList>
              <TabsTrigger value="employees">Employees ({req.employees?.length ?? 0})</TabsTrigger>
              {(req.groups?.length ?? 0) > 0 && (
                <TabsTrigger value="groups">Groups ({req.groups?.length})</TabsTrigger>
              )}
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="employees" className="mt-4">
              {canHodEdit && selectedEmpIds.length > 0 && (
                <div className="flex items-center gap-2 mb-3 p-3 rounded-lg border border-border bg-muted/50">
                  <span className="text-sm text-muted-foreground flex-1">
                    {selectedEmpIds.length} employee(s) selected
                  </span>
                  <Button variant="destructive" size="sm" onClick={handleRemoveSelected} disabled={removing}>
                    {removing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <UserMinus className="h-3.5 w-3.5 mr-1" />}
                    Remove Selected
                  </Button>
                </div>
              )}
              {req.employees && req.employees.length > 0 ? (
                <EmployeeSelectionTable
                  employees={req.employees}
                  selected={canHodEdit ? selectedEmpIds : req.employees.map(e => e.id)}
                  onChange={canHodEdit ? setSelectedEmpIds : () => {}}
                  readOnly={!canHodEdit}
                  places={canHodEdit ? places : undefined}
                  placesLoading={canHodEdit ? placesLoading : undefined}
                  onLocationUpdate={canHodEdit ? handleLocationUpdate : undefined}
                />
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No employees added yet
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {(req.groups?.length ?? 0) > 0 && (
              <TabsContent value="groups" className="mt-4 space-y-3">
                {req.groups!.map(g => (
                  <Card key={g.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{g.group_code}</span>
                          <Badge variant={g.status === 'CONFIRMED' ? 'default' : 'secondary'}>{g.status}</Badge>
                          {(g.overflow_count ?? 0) > 0 && <Badge variant="destructive">Overflow +{g.overflow_count}</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {g.employee_count} employees
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-muted-foreground">Vehicle:</span> <span className="font-medium">{g.assigned_vehicle_reg || 'Unassigned'}</span></div>
                        <div><span className="text-muted-foreground">Driver:</span> <span className="font-medium">{g.driver_name || 'Auto-derived'}</span></div>
                        <div><span className="text-muted-foreground">Corridor:</span> <span className="font-medium">{g.corridor_code || '—'}</span></div>
                        <div><span className="text-muted-foreground">Distance:</span> <span className="font-medium">{g.estimated_distance_km ? `${Number(g.estimated_distance_km).toFixed(1)} km` : '—'}</span></div>
                      </div>
                      {g.cluster_note && <p className="text-xs text-muted-foreground mt-2">{g.cluster_note}</p>}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            )}

            <TabsContent value="history" className="mt-4">
              <RequestStatusHistoryPanel history={req.status_history ?? []} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Timeline */}
        <div>
          <WorkflowTimelinePanel currentStatus={req.status} statusHistory={req.status_history} />
        </div>
      </div>
    </div>
  );
}
