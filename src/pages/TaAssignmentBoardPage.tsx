import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkflowApi } from '@/hooks/useWorkflowApi';
import CapacityWarningBanner from '@/components/workflow/CapacityWarningBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft, Send, CheckCircle, AlertTriangle, Loader2,
  Calendar, ChevronDown, Bus, Truck, User, Phone, MapPin, Route, Clock, Map, Undo2, X,
  Scissors, Info,
} from 'lucide-react';

/**
 * Effective capacity: capacity + overflow allowance.
 * Uses vehicle.soft_overflow if set > 0, else type defaults (VAN=4, BUS=10).
 * Must match GroupingService.getEffectiveCapacity on backend.
 */
const TYPE_OVERFLOW_DEFAULTS: Record<string, number> = { VAN: 4, BUS: 10 };
function getEffectiveCapacity(v: { capacity: number; soft_overflow?: number; type?: string }): number {
  const overflow = (v.soft_overflow != null && v.soft_overflow > 0)
    ? v.soft_overflow
    : (TYPE_OVERFLOW_DEFAULTS[(v.type || '').toUpperCase()] ?? 0);
  return v.capacity + overflow;
}

function getOverflow(v: { capacity: number; soft_overflow?: number; type?: string }): number {
  return (v.soft_overflow != null && v.soft_overflow > 0)
    ? v.soft_overflow
    : (TYPE_OVERFLOW_DEFAULTS[(v.type || '').toUpperCase()] ?? 0);
}

interface VehicleData {
  id: number;
  registration_no: string;
  type: string;
  capacity: number;
  soft_overflow?: number;
  driver_name?: string;
  driver_phone?: string;
  driver_license_no?: string;
  is_active?: boolean;
}

interface GroupData {
  id: number;
  group_code: string;
  corridor_code?: string;
  corridor_label?: string;
  employee_count: number;
  status: string;
  recommended_vehicle_id?: number;
  assigned_vehicle_id?: number;
  assigned_vehicle_reg?: string;
  driver_name?: string;
  driver_phone?: string;
  has_permanent_driver?: boolean;
  overflow_allowed?: boolean;
  overflow_count?: number;
  recommendation_reason?: string;
  cluster_note?: string;
  estimated_distance_km?: number;
  estimated_duration_seconds?: number;
  routing_source?: string;
  route_geometry?: number[][];
  members?: any[];
  fits_single_vehicle?: boolean;
  fits_single_vehicle_with_overflow?: boolean;
  requires_split?: boolean;
  assignment_block_reason?: string;
}

interface RunData {
  id: number;
  run_number: number;
  total_groups: number;
  total_employees: number;
  unresolved_count: number;
  summary?: string;
  routing_source?: string;
  routing_warning?: string;
  groups?: GroupData[];
  parameters?: any;
  daily_run_id?: number;
  daily_run_status?: string;
  request_count?: number;
  department_count?: number;
}

/**
 * Compute a split preview: which stops go to which vehicle.
 * Mirrors the backend's advanced scoring-based split algorithm.
 */
function computeSplitPreview(
  members: any[],
  selectedVehicles: VehicleData[],
): { vehicle: VehicleData; startIdx: number; endIdx: number; count: number; overflow: number }[] {
  if (!members?.length || !selectedVehicles.length) return [];

  // Sort vehicles by effective capacity descending (largest gets biggest segment)
  const sorted = [...selectedVehicles].sort((a, b) => getEffectiveCapacity(b) - getEffectiveCapacity(a));
  const effCaps = sorted.map(v => getEffectiveCapacity(v));
  const baseCaps = sorted.map(v => v.capacity);
  const totalEffCap = effCaps.reduce((a, b) => a + b, 0);
  const n = sorted.length;
  const totalMembers = members.length;

  // Proportional allocation
  const targets: number[] = new Array(n);
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      targets[i] = totalMembers - allocated;
    } else {
      const ideal = Math.round((effCaps[i] / totalEffCap) * totalMembers);
      const clamped = Math.max(1, Math.min(ideal, effCaps[i], totalMembers - allocated - (n - i - 1)));
      targets[i] = clamped;
      allocated += clamped;
    }
  }

  // Validate & fix overflows
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (targets[i] > effCaps[i]) {
        const excess = targets[i] - effCaps[i];
        targets[i] = effCaps[i];
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const room = effCaps[j] - targets[j];
          if (room > 0) {
            const take = Math.min(excess, room);
            targets[j] += take;
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }

  // Local rebalance
  for (let iter = 0; iter < 2; iter++) {
    let improved = false;
    for (let i = 0; i < n - 1; i++) {
      const score = (sz: number, base: number, eff: number) => {
        if (sz > eff || sz <= 0) return -1000;
        let s = 100;
        if (sz <= base) s += 50 + (sz / base) * 30;
        else s -= ((sz - base) / Math.max(1, eff - base)) * 25;
        if (sz < 3) s -= (3 - sz) * 15;
        return s;
      };
      const cur = score(targets[i], baseCaps[i], effCaps[i]) + score(targets[i + 1], baseCaps[i + 1], effCaps[i + 1]);
      if (targets[i] > 1 && targets[i + 1] + 1 <= effCaps[i + 1]) {
        const ns = score(targets[i] - 1, baseCaps[i], effCaps[i]) + score(targets[i + 1] + 1, baseCaps[i + 1], effCaps[i + 1]);
        if (ns > cur) { targets[i]--; targets[i + 1]++; improved = true; continue; }
      }
      if (targets[i + 1] > 1 && targets[i] + 1 <= effCaps[i]) {
        const ns = score(targets[i] + 1, baseCaps[i], effCaps[i]) + score(targets[i + 1] - 1, baseCaps[i + 1], effCaps[i + 1]);
        if (ns > cur) { targets[i]++; targets[i + 1]--; improved = true; continue; }
      }
    }
    if (!improved) break;
  }

  // Fix total
  const totalAlloc = targets.reduce((a, b) => a + b, 0);
  if (totalAlloc !== totalMembers) targets[n - 1] += totalMembers - totalAlloc;

  // Build preview
  const preview: { vehicle: VehicleData; startIdx: number; endIdx: number; count: number; overflow: number }[] = [];
  let offset = 0;
  for (let i = 0; i < n; i++) {
    const count = targets[i];
    if (count <= 0) continue;
    preview.push({
      vehicle: sorted[i],
      startIdx: offset,
      endIdx: offset + count - 1,
      count,
      overflow: Math.max(0, count - sorted[i].capacity),
    });
    offset += count;
  }
  return preview;
}

export default function TaAssignmentBoardPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const wfApi = useWorkflowApi();
  const [run, setRun] = useState<RunData | null>(null);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Per-group selected vehicles state: groupId -> vehicleId[]
  const [selectedVehicles, setSelectedVehicles] = useState<Record<number, number[]>>({});
  const [assigningGroupId, setAssigningGroupId] = useState<number | null>(null);

  useEffect(() => {
    if (!date) return;
    setPageLoading(true);
    (async () => {
      try {
        const v = await wfApi.fetchVehicles();
        setVehicles(v);
        const runData = await wfApi.fetchDailyGroupingRun(date);
        if (runData) {
          setRun(runData);
          setGroups(runData.groups || []);
        }
      } catch { /* shown by hook */ } finally {
        setPageLoading(false);
      }
    })();
  }, [date]);

  // Vehicles already assigned to other groups in this run
  const assignedVehicleIds = new Set(
    groups.filter(g => g.assigned_vehicle_id).map(g => g.assigned_vehicle_id!),
  );

  const toggleVehicle = (groupId: number, vehicleId: number) => {
    setSelectedVehicles(prev => {
      const current = prev[groupId] || [];
      const next = current.includes(vehicleId)
        ? current.filter(id => id !== vehicleId)
        : [...current, vehicleId];
      return { ...prev, [groupId]: next };
    });
  };

  const getSelectedForGroup = (groupId: number): number[] => selectedVehicles[groupId] || [];

  const getSelectedCapacity = (groupId: number): number => {
    return getSelectedForGroup(groupId).reduce((sum, vid) => {
      const v = vehicles.find(x => x.id === vid);
      return sum + (v ? getEffectiveCapacity(v) : 0);
    }, 0);
  };

  const handleAssign = async (group: GroupData) => {
    const selected = getSelectedForGroup(group.id);
    if (selected.length === 0) return;

    setAssigningGroupId(group.id);
    try {
      if (selected.length === 1) {
        const v = vehicles.find(x => x.id === selected[0]);
        if (v && group.employee_count <= getEffectiveCapacity(v)) {
          const result: any = await wfApi.assignVehicle(group.id, selected[0]);
          setGroups(gs => gs.map(g => g.id === group.id ? {
            ...g,
            assigned_vehicle_id: selected[0],
            assigned_vehicle_reg: result?.assigned_vehicle_reg || v.registration_no,
            driver_name: result?.driver_name || v.driver_name,
            driver_phone: result?.driver_phone || v.driver_phone,
            has_permanent_driver: result?.has_permanent_driver ?? !!v.driver_name,
            overflow_allowed: result?.overflow_used || false,
            overflow_count: result?.overflow_count || 0,
            status: 'CONFIRMED',
          } : g));
          setSelectedVehicles(prev => ({ ...prev, [group.id]: [] }));
        }
      } else {
        const result: any = await wfApi.splitAssignGroup(group.id, selected);
        if (result?.subGroups) {
          setGroups(gs => {
            const filtered = gs.filter(g => g.id !== group.id);
            return [...filtered, ...result.subGroups];
          });
          if (run) {
            setRun({ ...run, total_groups: (run.total_groups || 0) + result.subGroups.length - 1 });
          }
        }
        setSelectedVehicles(prev => ({ ...prev, [group.id]: [] }));
      }
    } catch { /* shown by hook */ } finally {
      setAssigningGroupId(null);
    }
  };

  const handleUnassign = async (groupId: number) => {
    try {
      await wfApi.unassignVehicle(groupId);
      setGroups(gs => gs.map(g => g.id === groupId ? {
        ...g,
        assigned_vehicle_id: undefined,
        assigned_vehicle_reg: undefined,
        driver_name: undefined,
        driver_phone: undefined,
        has_permanent_driver: undefined,
        status: 'PENDING',
      } : g));
    } catch { /* shown by hook */ }
  };

  const handleUndoSplit = async (subGroupId: number) => {
    try {
      const result: any = await wfApi.undoSplit(subGroupId);
      if (result?.mergedGroupId && date) {
        const runData = await wfApi.fetchDailyGroupingRun(date);
        if (runData) {
          setRun(runData);
          setGroups(runData.groups || []);
        }
      }
    } catch { /* shown by hook */ }
  };

  const getDriver = (g: GroupData) => {
    if (g.driver_name) return { name: g.driver_name, phone: g.driver_phone };
    if (!g.assigned_vehicle_id) return null;
    const v = vehicles.find(x => x.id === g.assigned_vehicle_id);
    if (v?.driver_name) return { name: v.driver_name, phone: v.driver_phone };
    return null;
  };

  const assignedCount = groups.filter(g => g.assigned_vehicle_id).length;
  const readyCount = groups.filter(g => g.assigned_vehicle_id && getDriver(g)).length;
  const allReady = groups.length > 0 && readyCount === groups.length;
  const overflowGroups = groups.filter(g => (g.overflow_count ?? 0) > 0).length;
  const progress = groups.length > 0 ? Math.round((readyCount / groups.length) * 100) : 0;

  const totalDistanceKm = groups.reduce((s, g) => s + (Number(g.estimated_distance_km) || 0), 0);
  const totalDurationMin = Math.round(groups.reduce((s, g) => s + (Number(g.estimated_duration_seconds) || 0), 0) / 60);
  const isAmazon = run?.routing_source === 'AMAZON_ROUTE';

  const isSplitSubGroup = (g: GroupData): boolean => /-V\d+$/.test(g.group_code);

  const canUnassign = (g: GroupData): boolean => {
    if (g.status !== 'CONFIRMED') return false;
    const drStatus = run?.daily_run_status;
    return drStatus !== 'DISPATCHED' && drStatus !== 'CLOSED';
  };

  const canUndoSplit = (g: GroupData): boolean => {
    if (!isSplitSubGroup(g)) return false;
    const drStatus = run?.daily_run_status;
    return drStatus !== 'DISPATCHED' && drStatus !== 'CLOSED';
  };

  if (pageLoading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/ta/processing')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">Drop-Off Assignment Board</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />{date}
            </span>
            {run && <span>· Run #{run.run_number}</span>}
            {run?.request_count && <span>· {run.request_count} requests</span>}
            {run?.department_count && <span>· {run.department_count} depts</span>}
            <Badge variant={isAmazon ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0">
              {isAmazon ? 'Amazon Routes' : 'Haversine Fallback'}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {run && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate(`/route-map/daily/${date}`)}>
              <Map className="mr-1 h-3.5 w-3.5" /> Map
            </Button>
          )}
          {run && (
            <Badge variant={allReady ? 'default' : 'secondary'}>
              {readyCount}/{groups.length} Ready
            </Badge>
          )}
        </div>
      </div>

      {!run ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Bus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">No grouping run found</p>
            <p className="text-sm text-muted-foreground">Run grouping from the processing queue first.</p>
            <Button variant="outline" onClick={() => navigate('/ta/processing')}>Back to Queue</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <CapacityWarningBanner unresolvedCount={run.unresolved_count} overflowGroups={overflowGroups} totalGroups={groups.length} />

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatMini label="Groups" value={groups.length} icon={<Route className="h-4 w-4 text-primary" />} />
            <StatMini label="Employees" value={run.total_employees} icon={<User className="h-4 w-4 text-primary" />} />
            <StatMini label="Total Distance" value={`${totalDistanceKm.toFixed(1)} km`} icon={<MapPin className="h-4 w-4 text-primary" />} />
            <StatMini label="Total Duration" value={`${totalDurationMin} min`} icon={<Clock className="h-4 w-4 text-primary" />} />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Assignment Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {run.routing_warning && (
            <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
              <p className="text-xs text-[hsl(var(--warning))]">{run.routing_warning}</p>
            </div>
          )}

          {run.unresolved_count > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{run.unresolved_count} employee(s) excluded — unresolved destinations.</p>
            </div>
          )}

          <div className="space-y-3">
            {groups.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Route className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-foreground text-sm">No groups in this run</p>
                  <p className="text-xs text-muted-foreground">The grouping run completed but produced no groups. Check if approved requests exist for this date.</p>
                </CardContent>
              </Card>
            )}
            {groups.map(g => {
              const driver = getDriver(g);
              const isReady = !!g.assigned_vehicle_id && !!driver;
              const noDriver = !!g.assigned_vehicle_id && !driver;
              const distKm = g.estimated_distance_km ? Number(g.estimated_distance_km).toFixed(1) : null;
              const durMin = g.estimated_duration_seconds ? Math.round(Number(g.estimated_duration_seconds) / 60) : null;
              const isAssigned = !!g.assigned_vehicle_id;

              const selected = getSelectedForGroup(g.id);
              const selectedCapacity = getSelectedCapacity(g.id);
              const capacityEnough = selectedCapacity >= g.employee_count;
              const remaining = g.employee_count - selectedCapacity;
              const willSplit = selected.length > 1 && capacityEnough;
              const isAssigning = assigningGroupId === g.id;

              // Compute split preview for multi-vehicle selection
              const selectedVehicleObjs = selected.map(vid => vehicles.find(x => x.id === vid)).filter(Boolean) as VehicleData[];
              const splitPreview = willSplit && g.members ? computeSplitPreview(g.members, selectedVehicleObjs) : [];

              return (
                <Card key={g.id} className={`overflow-hidden transition-colors ${isReady ? 'border-primary/20' : noDriver ? 'border-destructive/30' : ''}`}>
                  <CardContent className="p-0">
                    {/* Group header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isReady ? 'bg-primary' : noDriver ? 'bg-destructive' : 'bg-muted-foreground/30'}`} />
                        <span className="font-semibold text-sm text-foreground">{g.group_code}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {g.employee_count} emp
                        </Badge>
                        {distKm && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {distKm} km
                          </Badge>
                        )}
                        {durMin !== null && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {durMin} min
                          </Badge>
                        )}
                        {(g.overflow_count ?? 0) > 0 && isAssigned && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            +{g.overflow_count} overflow
                          </Badge>
                        )}
                        {g.routing_source && (
                          <Badge variant={g.routing_source === 'AMAZON_ROUTE' ? 'default' : 'secondary'} className="text-[9px] px-1 py-0">
                            {g.routing_source === 'AMAZON_ROUTE' ? 'Amazon' : 'Haversine'}
                          </Badge>
                        )}
                      </div>
                      {isReady ? (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      ) : noDriver ? (
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      ) : null}
                    </div>

                    <div className="px-4 py-3 space-y-2.5">
                      {/* Assigned vehicle capacity info */}
                      {isAssigned && (() => {
                        const v = vehicles.find(x => x.id === g.assigned_vehicle_id);
                        const effCap = v ? getEffectiveCapacity(v) : 0;
                        const overflow = v ? getOverflow(v) : 0;
                        const overflowUsed = v ? g.employee_count > v.capacity : false;
                        return (
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <Badge variant="outline" className="py-0 px-1.5">
                              Members: {g.employee_count}
                            </Badge>
                            {v && (
                              <>
                                <Badge variant="outline" className="py-0 px-1.5">
                                  Cap: {v.capacity}
                                </Badge>
                                <Badge variant="outline" className="py-0 px-1.5">
                                  Overflow: {overflow}
                                </Badge>
                                <Badge variant="outline" className="py-0 px-1.5">
                                  Eff: {effCap}
                                </Badge>
                                {overflowUsed ? (
                                  <Badge variant="secondary" className="py-0 px-1.5 text-[hsl(var(--warning))]">
                                    Overflow Used: +{g.employee_count - v.capacity}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="py-0 px-1.5 text-primary">
                                    ✓ Capacity OK
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {/* ═══ VEHICLE SELECTION (for unassigned groups) ═══ */}
                      {!isAssigned && g.status !== 'CONFIRMED' && (
                        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
                          <p className="text-xs font-medium text-foreground">
                            Select vehicle(s) for {g.employee_count} employees:
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Select one or multiple vehicles. Total combined capacity is validated. Route is split into contiguous segments automatically.
                          </p>

                          {/* Vehicle checkboxes */}
                          <div className="space-y-1 max-h-56 overflow-y-auto">
                            {vehicles.filter(v => {
                              if (v.is_active === false) return false;
                              if (assignedVehicleIds.has(v.id)) return false;
                              return true;
                            }).map(v => {
                              const effCap = getEffectiveCapacity(v);
                              const overflow = getOverflow(v);
                              const isChecked = selected.includes(v.id);
                              const hasDriver = !!v.driver_name;
                              return (
                                <label
                                  key={v.id}
                                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer text-xs transition-colors ${
                                    isChecked ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'
                                  } ${!hasDriver ? 'opacity-50' : ''}`}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    disabled={!hasDriver}
                                    onCheckedChange={() => toggleVehicle(g.id, v.id)}
                                  />
                                  <span className="flex items-center gap-2 flex-1 flex-wrap">
                                    {v.type?.toLowerCase().includes('bus') ? (
                                      <Bus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    ) : (
                                      <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    )}
                                    <span className="font-medium">{v.registration_no}</span>
                                    <span className="text-muted-foreground">{v.type}</span>
                                    <span className="text-muted-foreground">
                                      Cap: {v.capacity} | Overflow: {overflow} | Eff: {effCap}
                                    </span>
                                    {hasDriver && (
                                      <span className="text-muted-foreground text-[10px]">({v.driver_name})</span>
                                    )}
                                    {!hasDriver && (
                                      <span className="text-destructive text-[10px] flex items-center gap-0.5">
                                        <AlertTriangle className="h-2.5 w-2.5" /> No Driver
                                      </span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>

                          {/* Combined capacity summary */}
                          {selected.length > 0 && (
                            <div className="rounded-md bg-muted/50 p-2.5 space-y-2">
                              <div className="flex flex-wrap gap-1.5 text-[10px]">
                                <Badge variant="outline" className="py-0 px-1.5">
                                  Group: {g.employee_count} emp
                                </Badge>
                                <Badge variant="outline" className="py-0 px-1.5">
                                  Vehicles: {selected.length}
                                </Badge>
                                <Badge variant="outline" className="py-0 px-1.5">
                                  Total Capacity: {selectedCapacity}
                                </Badge>
                              </div>

                              {/* Per-vehicle capacity breakdown */}
                              <div className="space-y-0.5">
                                {selectedVehicleObjs.map(v => {
                                  const eff = getEffectiveCapacity(v);
                                  return (
                                    <div key={v.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                      {v.type?.toLowerCase().includes('bus') ? <Bus className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                                      <span>{v.registration_no}</span>
                                      <span className="text-foreground/70">Cap: {v.capacity} + {getOverflow(v)} = {eff}</span>
                                    </div>
                                  );
                                })}
                              </div>

                              {capacityEnough ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-primary font-medium">✓ Enough capacity</span>
                                  </div>
                                  {willSplit && (
                                    <div className="flex items-start gap-1.5 text-xs">
                                      <Scissors className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                      <span className="text-muted-foreground">
                                        Split will be created automatically — {selected.length} contiguous route segments
                                      </span>
                                    </div>
                                  )}

                                  {/* ═══ SPLIT PREVIEW ═══ */}
                                  {splitPreview.length > 0 && (
                                    <div className="rounded border border-border/50 bg-background p-2 space-y-1">
                                      <p className="text-[10px] font-medium text-foreground flex items-center gap-1">
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                        Split Preview (contiguous route segments):
                                      </p>
                                      {splitPreview.map((sp, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-[10px] px-1.5 py-1 rounded bg-muted/40">
                                          <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                                            {idx + 1}
                                          </span>
                                          {sp.vehicle.type?.toLowerCase().includes('bus') ? <Bus className="h-3 w-3 text-muted-foreground" /> : <Truck className="h-3 w-3 text-muted-foreground" />}
                                          <span className="font-medium text-foreground">{sp.vehicle.registration_no}</span>
                                          <span className="text-muted-foreground">→</span>
                                          <span className="text-foreground">
                                            Stops {sp.startIdx + 1}–{sp.endIdx + 1}
                                          </span>
                                          <Badge variant="outline" className="py-0 px-1 text-[9px]">
                                            {sp.count} emp
                                          </Badge>
                                          {sp.overflow > 0 && (
                                            <Badge variant="secondary" className="py-0 px-1 text-[9px] text-[hsl(var(--warning))]">
                                              +{sp.overflow} overflow
                                            </Badge>
                                          )}
                                          {sp.overflow === 0 && (
                                            <Badge variant="secondary" className="py-0 px-1 text-[9px] text-primary">
                                              ✓ Normal
                                            </Badge>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                  <span className="text-destructive font-medium">
                                    Not enough capacity — need {remaining} more seats
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Assign button */}
                          <div className="flex gap-2">
                            {selected.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => setSelectedVehicles(prev => ({ ...prev, [g.id]: [] }))}
                              >
                                Clear
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="text-xs gap-1.5"
                              disabled={selected.length === 0 || !capacityEnough || isAssigning}
                              onClick={() => handleAssign(g)}
                            >
                              {isAssigning ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : willSplit ? (
                                <Scissors className="h-3 w-3" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                              {selected.length <= 1
                                ? 'Assign Vehicle'
                                : `Split & Assign ${selected.length} Vehicles`}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Driver info (assigned vehicle) */}
                      {isAssigned && (
                        <div className="rounded-md bg-muted/50 px-3 py-2">
                          {driver ? (
                            <div className="flex items-center gap-3 text-xs">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground truncate">{driver.name}</p>
                                {driver.phone && (
                                  <p className="text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-2.5 w-2.5" />{driver.phone}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-[9px]">Permanent Driver</Badge>
                            </div>
                          ) : (
                            <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                              <AlertTriangle className="h-3 w-3" />
                              No permanent driver — assign one in Vehicle Management first.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Unassign / Undo Split actions */}
                      {canUnassign(g) && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => handleUnassign(g.id)}
                          >
                            <X className="h-3 w-3" /> Unassign
                          </Button>
                          {canUndoSplit(g) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={() => handleUndoSplit(g.id)}
                            >
                              <Undo2 className="h-3 w-3" /> Undo Split
                            </Button>
                          )}
                        </div>
                      )}
                      {!canUnassign(g) && canUndoSplit(g) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => handleUndoSplit(g.id)}
                        >
                          <Undo2 className="h-3 w-3" /> Undo Split
                        </Button>
                      )}

                      {g.corridor_label && (
                        <p className="text-[11px] text-muted-foreground">Direction: {g.corridor_label.replace(/^Corridor\s*/i, 'Area ')}</p>
                      )}
                      {g.cluster_note && (
                        <p className="text-[11px] text-muted-foreground">{g.cluster_note}</p>
                      )}
                    </div>

                    {/* Members collapsible */}
                    {g.members && g.members.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <button className="w-full flex items-center justify-between px-4 py-2 border-t border-border/50 text-xs text-muted-foreground hover:bg-muted/30 transition-colors">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3" />
                              {g.employee_count} drop-off stops
                            </span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-3 space-y-1">
                            {g.members.map((m: any, idx: number) => (
                              <div key={m.employee_id || idx} className="flex items-center gap-2 text-[11px] py-1 px-2 rounded bg-muted/40">
                                <span className="w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-mono text-muted-foreground shrink-0">
                                  {m.stop_sequence || idx + 1}
                                </span>
                                <span className="flex-1 truncate text-foreground">
                                  {m.full_name || m.emp_no || `Emp #${m.employee_id}`}
                                </span>
                                {m.depot_distance_km != null && (
                                  <span className="text-muted-foreground text-[10px]">
                                    {Number(m.depot_distance_km).toFixed(1)} km
                                  </span>
                                )}
                                <span className="text-muted-foreground font-mono text-[10px]">
                                  {Number(m.lat_snapshot || 0).toFixed(4)}, {Number(m.lng_snapshot || 0).toFixed(4)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Submit bar */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border -mx-4 px-4 py-3 flex items-center gap-3">
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate('/ta/processing')}>
              Back
            </Button>
            <div className="flex-1" />
            <Button
              size="sm"
              disabled={!allReady || submitting || submitted}
              onClick={async () => {
                if (!date) return;
                setSubmitting(true);
                try {
                  await wfApi.submitDailyToHr(date);
                  setSubmitted(true);
                } catch { /* shown by hook */ } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> :
               submitted ? <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> :
               <Send className="mr-1.5 h-3.5 w-3.5" />}
              {submitted ? 'Submitted to HR' : 'Submit to HR'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function StatMini({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-center">
      {icon && <div className="flex justify-center mb-1">{icon}</div>}
      <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
