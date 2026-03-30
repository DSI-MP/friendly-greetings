import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Users, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface Department { id: number; name: string; }
interface OtEmployee { emp_no: string; full_name: string; }

export default function OtPlanPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [otNote, setOtNote] = useState('');
  const [workFinishTime, setWorkFinishTime] = useState('');
  const [employees, setEmployees] = useState<OtEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [deptsLoading, setDeptsLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      setDeptsLoading(true);
      try {
        const res = await api.get('/departments', { params: { limit: 200 } });
        const d = res.data?.data ?? res.data;
        const items = d?.items || d || [];
        setDepartments(Array.isArray(items) ? items : []);
      } catch {
        setDepartments([]);
        toast({ title: 'Error', description: 'Failed to load departments', variant: 'destructive' });
      } finally {
        setDeptsLoading(false);
      }
    })();
  }, []);

  const fetchEmployees = useCallback(async () => {
    if (!selectedDeptId || !date) return;
    setLoading(true);
    try {
      const res = await api.get('/employees', { params: { departmentId: Number(selectedDeptId), limit: 500 } });
      const d = res.data?.data ?? res.data;
      const items = d?.items || d || [];
      setEmployees(
        (Array.isArray(items) ? items : []).map((e: any) => ({
          emp_no: e.emp_no || `EMP-${e.id}`,
          full_name: e.full_name || '',
        }))
      );
    } catch {
      setEmployees([]);
      toast({ title: 'Error', description: 'Failed to load employees', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedDeptId, date]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const selectedDept = departments.find(d => String(d.id) === selectedDeptId);

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast({ title: 'Blocked', description: 'Please allow popups to print the OT Plan', variant: 'destructive' });
      return;
    }
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>OT Plan – ${selectedDept?.name || 'Department'} – ${date}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; padding: 24px; font-size: 11pt; }
  h2 { font-size: 16pt; margin-bottom: 2px; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 16px; font-size: 10pt; }
  .meta .full { grid-column: 1 / -1; }
  .meta span.label { font-weight: 700; }
  .blank-line { border-bottom: 1px solid #000; display: inline-block; min-width: 200px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #000; padding: 5px 8px; text-align: left; font-size: 10pt; }
  th { background: #f0f0f0; font-weight: 700; }
  .total { text-align: right; font-weight: 700; font-size: 10pt; margin-top: 4px; }
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
    // Wait for content to render then trigger print
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
    // Fallback if onload doesn't fire
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Department OT Plan</h1>
          <p className="text-sm text-muted-foreground">Generate printable OT plans per department</p>
        </div>
        <Button onClick={handlePrint} disabled={!selectedDeptId || employees.length === 0} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print OT Plan
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Department *</Label>
              {deptsLoading ? <Skeleton className="h-10" /> : (
                <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
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

      {!selectedDeptId ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <p className="font-medium text-foreground">Select a department</p>
            <p className="text-sm text-muted-foreground">Choose a department and date to generate the OT plan.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-medium text-foreground">No employees found</p>
            <p className="text-sm text-muted-foreground">No employees found for this department.</p>
          </CardContent>
        </Card>
      ) : (
        /* ── Printable OT Plan Preview ── */
        <Card>
          <CardContent className="p-6">
            <div ref={printRef}>
              <div className="header">
                <h2>DEPARTMENT OT PLAN</h2>
                <p style={{ fontSize: '13pt', fontWeight: 600, marginTop: 4 }}>{selectedDept?.name || 'Department'}</p>
              </div>

              <div className="meta">
                <div><span className="label">Date: </span>{date}</div>
                <div><span className="label">Work Finish Time: </span>{workFinishTime || <span className="blank-line">&nbsp;</span>}</div>
                <div className="full"><span className="label">OT Note: </span>{otNote || <span className="blank-line" style={{ minWidth: 400 }}>&nbsp;</span>}</div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>EMP No</th>
                    <th>EMP Name</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 500 }}>{emp.emp_no}</td>
                      <td>{emp.full_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="total">Total Employees: {employees.length}</div>

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
                <span>OT Plan — {selectedDept?.name} — {date}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
