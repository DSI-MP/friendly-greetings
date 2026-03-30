import { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, CalendarDays, AlertCircle, FileCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface OtEmployee {
  employeeId: number;
  empNo: string;
  fullName: string;
}

interface OtDepartmentRow {
  departmentId: number;
  departmentName: string;
  employees: OtEmployee[];
  totalEmployees: number;
}

interface OtPlanMeta {
  readiness: string;
  workflowStatus: string;
  requestDate: string;
  generatedAt: string;
  totalDepartments: number;
  totalEmployees: number;
}

export default function OtPlanPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<OtDepartmentRow[]>([]);
  const [meta, setMeta] = useState<OtPlanMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchOtPlan = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setLoaded(false);
    try {
      const res = await api.get('/reports/ot-plan', { params: { date } });
      const data = res.data?.data ?? res.data;
      setRows(data.rows || []);
      setMeta(data.meta || null);
      setDeptFilter('all');
      setLoaded(true);
    } catch {
      setRows([]);
      setMeta(null);
      setLoaded(true);
      toast({ title: 'Error', description: 'Failed to load OT plan data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  const filteredRows = deptFilter === 'all' ? rows : rows.filter(r => String(r.departmentId) === deptFilter);
  const grandTotal = filteredRows.reduce((sum, r) => sum + r.totalEmployees, 0);
  const isReady = meta?.readiness === 'ready';

  const statusLabel = (status?: string) => {
    switch (status) {
      case 'OPEN': return 'Open — not yet locked';
      case 'LOCKED': return 'Locked — awaiting grouping';
      case 'GROUPED': return 'Grouped — awaiting assignment';
      case 'ASSIGNING': return 'Assigning vehicles';
      case 'READY': return 'Ready — awaiting HR submission';
      case 'SUBMITTED_TO_HR': return 'Submitted to HR — awaiting approval';
      case 'HR_APPROVED': return 'HR Approved ✓';
      case 'DISPATCHED': return 'Dispatched ✓';
      case 'CLOSED': return 'Closed ✓';
      default: return status || 'Unknown';
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast({ title: 'Blocked', description: 'Please allow popups to print the OT Plan', variant: 'destructive' });
      return;
    }
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Final OT Plan – ${date}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; padding: 24px; font-size: 11pt; }
  h2 { font-size: 16pt; margin-bottom: 2px; }
  h3 { font-size: 13pt; margin: 18px 0 6px; border-bottom: 1px solid #999; padding-bottom: 4px; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 16px; font-size: 10pt; }
  .meta .full { grid-column: 1 / -1; }
  .meta span.label { font-weight: 700; }
  .blank-line { border-bottom: 1px solid #000; display: inline-block; min-width: 200px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #000; padding: 5px 8px; text-align: left; font-size: 10pt; }
  th { background: #f0f0f0; font-weight: 700; }
  .dept-total { text-align: right; font-weight: 700; font-size: 10pt; margin-bottom: 8px; }
  .grand-total { text-align: right; font-weight: 700; font-size: 11pt; margin-top: 12px; padding-top: 8px; border-top: 2px solid #000; }
  .sig-section { margin-top: 40px; padding-top: 16px; border-top: 2px solid #000; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px 40px; }
  .sig-box { margin-top: 36px; }
  .sig-line { border-bottom: 1px solid #000; margin-bottom: 4px; height: 24px; }
  .sig-label { font-size: 9pt; font-weight: 700; }
  .sig-note { font-size: 8pt; color: #555; font-style: italic; margin-top: 4px; }
  .disclaimer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 7.5pt; color: #888; font-style: italic; }
  .footer { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 6px; font-size: 7.5pt; color: #888; display: flex; justify-content: space-between; }
  @media print { body { padding: 0; } }
</style></head><body>
${html}
</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Final OT Plan</h1>
          <p className="text-sm text-muted-foreground">View and print final OT plans from approved daily transport results</p>
        </div>
        <Button onClick={handlePrint} disabled={!isReady || filteredRows.length === 0} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print OT Plan
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label>&nbsp;</Label>
              <Button onClick={fetchOtPlan} disabled={!date || loading} className="w-full">
                {loading ? 'Loading…' : 'Load OT Plan'}
              </Button>
            </div>
            {rows.length > 1 && (
              <div>
                <Label>Filter Department</Label>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {rows.map(r => (
                      <SelectItem key={r.departmentId} value={String(r.departmentId)}>{r.departmentName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Work Finish Time</Label>
              <Input type="time" value={workFinishTime} onChange={e => setWorkFinishTime(e.target.value)} />
            </div>
            <div>
              <Label>OT Note</Label>
              <Input value={otNote} onChange={e => setOtNote(e.target.value)} placeholder="Leave blank for pen fill" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* States */}
      {!loaded && !loading && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <p className="font-medium text-foreground">Select a date and load the OT plan</p>
            <p className="text-sm text-muted-foreground">The OT plan is generated from the final HR-approved transport results for the selected date.</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
      )}

      {loaded && !loading && !isReady && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-medium text-foreground">No final OT plan available for this date</p>
            <p className="text-sm text-muted-foreground">
              {meta?.workflowStatus && meta.workflowStatus !== 'UNKNOWN'
                ? `Current status: ${statusLabel(meta.workflowStatus)}. The OT plan becomes available only after HR final approval.`
                : 'No daily run found for this date. Transport requests must go through the full approval workflow before the OT plan is available.'}
            </p>
          </CardContent>
        </Card>
      )}

      {loaded && !loading && isReady && filteredRows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <FileCheck className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-medium text-foreground">No employees in the approved result</p>
            <p className="text-sm text-muted-foreground">The daily run is approved but contains no employee records.</p>
          </CardContent>
        </Card>
      )}

      {/* Printable OT Plan */}
      {loaded && !loading && isReady && filteredRows.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div ref={printRef}>
              <div className="header">
                <h2>FINAL OT PLAN</h2>
                <p style={{ fontSize: '11pt', marginTop: 4 }}>Approved Transport Result — {date}</p>
              </div>

              <div className="meta">
                <div><span className="label">Date: </span>{date}</div>
                <div><span className="label">Work Finish Time: </span>{workFinishTime || <span className="blank-line">&nbsp;</span>}</div>
                <div className="full"><span className="label">OT Note: </span>{otNote || <span className="blank-line" style={{ minWidth: 400 }}>&nbsp;</span>}</div>
              </div>

              {filteredRows.map((dept) => (
                <div key={dept.departmentId} style={{ marginBottom: 20 }}>
                  <h3>{dept.departmentName}</h3>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 50 }}>#</th>
                        <th>EMP No</th>
                        <th>EMP Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dept.employees.map((emp, idx) => (
                        <tr key={emp.employeeId}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 500 }}>{emp.empNo || '—'}</td>
                          <td>{emp.fullName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="dept-total">Department Total: {dept.totalEmployees}</div>
                </div>
              ))}

              <div className="grand-total">Grand Total Employees: {grandTotal}</div>

              <div className="sig-section">
                <div className="sig-grid">
                  <div className="sig-box">
                    <div className="sig-line"></div>
                    <div className="sig-label">Planning Department Executive Signature</div>
                  </div>
                  <div className="sig-box">
                    <div className="sig-line"></div>
                    <div className="sig-label">Factory Manager Signature</div>
                  </div>
                  <div className="sig-box">
                    <div className="sig-line"></div>
                    <div className="sig-label">Department Head Signature</div>
                  </div>
                  <div className="sig-box">
                    <div className="sig-line"></div>
                    <div className="sig-label">Chief System Administrator Signature</div>
                    <div className="sig-note">"This confirms that the provided information matches the system data."</div>
                  </div>
                </div>
                <div className="disclaimer">
                  This document remains valid even without the Chief System Administrator signature. If this signature is missing, the system is not responsible for any mismatch.
                </div>
              </div>

              <div className="footer">
                <span>Created by P.C.U Technical Team / W.O. Sandaruwan Jayalath</span>
                <span>Final OT Plan — {date}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
