import type {
  RouteWiseRow, VehicleWiseRow, DepartmentSummaryRow, GroupingReportRow,
  DispatchManifestRow, CostSummaryRow, ExceptionRow, ArchiveReportRow, ReportMeta,
} from '@/types/reports';

// ── Shared helpers ──
const today = new Date().toISOString().split('T')[0];
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })();

export const DEMO_META: ReportMeta = {
  title: 'Transport Drop-Off Report',
  requestCode: 'REQ-2026-0042',
  generatedAt: new Date().toISOString(),
  requestDate: today,
  department: 'Engineering',
  workflowStatus: 'HR_APPROVED',
  readiness: 'ready',
};

export const DEMO_ROUTE_WISE: RouteWiseRow[] = [
  { requestCode: 'REQ-2026-0042', requestDate: today, routeName: 'DSI to Galle', groupCode: 'GRP-A1', employeeNo: 'EMP-1001', employeeName: 'Kamal Perera', destination: 'Galle Fort Junction', vehicleReg: 'WP-KA-1234', driverName: 'Nimal Silva', driverPhone: '071-2345678', status: 'Assigned', stopSequence: 3, stops: ['Ambalangoda', 'Hikkaduwa Town', 'Galle Fort Junction'] },
  { requestCode: 'REQ-2026-0042', requestDate: today, routeName: 'DSI to Galle', groupCode: 'GRP-A1', employeeNo: 'EMP-1002', employeeName: 'Saman Jayawardena', destination: 'Hikkaduwa Town', vehicleReg: 'WP-KA-1234', driverName: 'Nimal Silva', driverPhone: '071-2345678', status: 'Assigned', stopSequence: 2, stops: ['Ambalangoda', 'Hikkaduwa Town', 'Galle Fort Junction'] },
  { requestCode: 'REQ-2026-0042', requestDate: today, routeName: 'DSI to Galle', groupCode: 'GRP-A1', employeeNo: 'EMP-1003', employeeName: 'Dilini Fernando', destination: 'Ambalangoda', vehicleReg: 'WP-KA-1234', driverName: 'Nimal Silva', driverPhone: '071-2345678', status: 'Assigned', stopSequence: 1, stops: ['Ambalangoda', 'Hikkaduwa Town', 'Galle Fort Junction'] },
  { requestCode: 'REQ-2026-0042', requestDate: today, routeName: 'DSI to Matara', groupCode: 'GRP-B2', employeeNo: 'EMP-1004', employeeName: 'Ruwan de Silva', destination: 'Matara Central', vehicleReg: 'WP-CB-5678', driverName: 'Sunil Bandara', driverPhone: '077-9876543', status: 'Assigned', stopSequence: 2, stops: ['Weligama', 'Matara Central'] },
  { requestCode: 'REQ-2026-0042', requestDate: today, routeName: 'DSI to Matara', groupCode: 'GRP-B2', employeeNo: 'EMP-1005', employeeName: 'Chamari Wickramasinghe', destination: 'Weligama', vehicleReg: 'WP-CB-5678', driverName: 'Sunil Bandara', driverPhone: '077-9876543', status: 'Assigned', stopSequence: 1, stops: ['Weligama', 'Matara Central'] },
  { requestCode: 'REQ-2026-0042', requestDate: today, routeName: 'DSI to Kottawa', groupCode: 'GRP-C3', employeeNo: 'EMP-1006', employeeName: 'Tharanga Rajapaksa', destination: 'Nugegoda', vehicleReg: 'WP-JA-9012', driverName: 'Ajith Kumara', driverPhone: '076-5551234', status: 'Assigned', stopSequence: 1, stops: ['Nugegoda', 'Maharagama', 'Kottawa'] },
  { requestCode: 'REQ-2026-0042', requestDate: today, routeName: 'DSI to Kottawa', groupCode: 'GRP-C3', employeeNo: 'EMP-1007', employeeName: 'Nadeesha Kumari', destination: 'Maharagama', vehicleReg: 'WP-JA-9012', driverName: 'Ajith Kumara', driverPhone: '076-5551234', status: 'Assigned', stopSequence: 2, stops: ['Nugegoda', 'Maharagama', 'Kottawa'] },
  { requestCode: 'REQ-2026-0042', requestDate: today, routeName: 'DSI to Kottawa', groupCode: 'GRP-C3', employeeNo: 'EMP-1008', employeeName: 'Priyantha Bandara', destination: 'Kottawa', vehicleReg: 'WP-JA-9012', driverName: 'Ajith Kumara', driverPhone: '076-5551234', status: 'Assigned', stopSequence: 3, stops: ['Nugegoda', 'Maharagama', 'Kottawa'] },
];

export const DEMO_VEHICLE_WISE: VehicleWiseRow[] = [
  { vehicleReg: 'WP-KA-1234', vehicleType: 'VAN', driverName: 'Nimal Silva', driverPhone: '071-2345678', groupCodes: ['GRP-A1'], employees: [{ empNo: 'EMP-1001', name: 'Kamal Perera' }, { empNo: 'EMP-1002', name: 'Saman Jayawardena' }, { empNo: 'EMP-1003', name: 'Dilini Fernando' }], capacity: 15, occupancy: 3, overflow: false },
  { vehicleReg: 'WP-CB-5678', vehicleType: 'BUS', driverName: 'Sunil Bandara', driverPhone: '077-9876543', groupCodes: ['GRP-B2'], employees: [{ empNo: 'EMP-1004', name: 'Ruwan de Silva' }, { empNo: 'EMP-1005', name: 'Chamari Wickramasinghe' }], capacity: 52, occupancy: 2, overflow: false },
  { vehicleReg: 'WP-JA-9012', vehicleType: 'VAN', driverName: 'Ajith Kumara', driverPhone: '076-5551234', groupCodes: ['GRP-C3'], employees: [{ empNo: 'EMP-1006', name: 'Tharanga Rajapaksa' }, { empNo: 'EMP-1007', name: 'Nadeesha Kumari' }, { empNo: 'EMP-1008', name: 'Priyantha Bandara' }], capacity: 15, occupancy: 3, overflow: false },
];

export const DEMO_DEPT_SUMMARY: DepartmentSummaryRow[] = [
  { departmentName: 'Engineering', totalEmployees: 5, assignedEmployees: 5, unassignedEmployees: 0, approvedStatus: 'HR Approved', requestStatus: 'HR_APPROVED', requestCode: 'REQ-2026-0042', reportReady: true },
  { departmentName: 'Operations', totalEmployees: 3, assignedEmployees: 3, unassignedEmployees: 0, approvedStatus: 'HR Approved', requestStatus: 'HR_APPROVED', requestCode: 'REQ-2026-0043', reportReady: true },
  { departmentName: 'Finance', totalEmployees: 2, assignedEmployees: 0, unassignedEmployees: 2, approvedStatus: 'Pending', requestStatus: 'SUBMITTED', requestCode: 'REQ-2026-0044', reportReady: false },
];

export const DEMO_GROUPING: GroupingReportRow[] = [
  { groupCode: 'GRP-A1', routeCorridor: 'Galle Corridor – South', memberCount: 3, clusterNote: 'Southern coastal cluster', recommendedVehicle: 'VAN', assignedVehicle: 'WP-KA-1234', driverName: 'Nimal Silva', overflowWarning: false, recommendationReason: 'Low member count, VAN capacity sufficient' },
  { groupCode: 'GRP-B2', routeCorridor: 'Matara Express', memberCount: 2, clusterNote: 'Deep south express', recommendedVehicle: 'VAN', assignedVehicle: 'WP-CB-5678 (BUS)', driverName: 'Sunil Bandara', overflowWarning: false, recommendationReason: 'Multi-group shared BUS' },
  { groupCode: 'GRP-C3', routeCorridor: 'Colombo Metro', memberCount: 3, clusterNote: 'Metro area cluster', recommendedVehicle: 'VAN', assignedVehicle: 'WP-JA-9012', driverName: 'Ajith Kumara', overflowWarning: false, recommendationReason: 'Short distance metro route' },
];

export const DEMO_DISPATCH_MANIFEST: DispatchManifestRow[] = [
  {
    requestDate: today, groupCode: 'GRP-A1', vehicleReg: 'WP-KA-1234', driverName: 'Nimal Silva', driverPhone: '071-2345678', notes: 'Depart depot at 18:30',
    employees: [
      { empNo: 'EMP-1001', name: 'Kamal Perera', destination: 'Galle Fort Junction', sequence: 1 },
      { empNo: 'EMP-1002', name: 'Saman Jayawardena', destination: 'Hikkaduwa Town', sequence: 2 },
      { empNo: 'EMP-1003', name: 'Dilini Fernando', destination: 'Ambalangoda', sequence: 3 },
    ],
  },
  {
    requestDate: today, groupCode: 'GRP-B2', vehicleReg: 'WP-CB-5678', driverName: 'Sunil Bandara', driverPhone: '077-9876543', notes: 'Depart depot at 18:30',
    employees: [
      { empNo: 'EMP-1004', name: 'Ruwan de Silva', destination: 'Matara Central', sequence: 1 },
      { empNo: 'EMP-1005', name: 'Chamari Wickramasinghe', destination: 'Weligama', sequence: 2 },
    ],
  },
  {
    requestDate: today, groupCode: 'GRP-C3', vehicleReg: 'WP-JA-9012', driverName: 'Ajith Kumara', driverPhone: '076-5551234', notes: 'Depart depot at 18:45',
    employees: [
      { empNo: 'EMP-1006', name: 'Tharanga Rajapaksa', destination: 'Nugegoda', sequence: 1 },
      { empNo: 'EMP-1007', name: 'Nadeesha Kumari', destination: 'Maharagama', sequence: 2 },
      { empNo: 'EMP-1008', name: 'Priyantha Bandara', destination: 'Kottawa', sequence: 3 },
    ],
  },
];

export const DEMO_COST_SUMMARY: CostSummaryRow[] = [
  { routeGroup: 'GRP-A1 (Galle Corridor)', estimatedDistanceKm: 115, estimatedCost: 4500, vehicleCost: 3200, costPerEmployee: 1500, departmentTotal: 4500, employeeCount: 3 },
  { routeGroup: 'GRP-B2 (Matara Express)', estimatedDistanceKm: 160, estimatedCost: 5800, vehicleCost: 4200, costPerEmployee: 2900, departmentTotal: 5800, employeeCount: 2 },
  { routeGroup: 'GRP-C3 (Colombo Metro)', estimatedDistanceKm: 28, estimatedCost: 1800, vehicleCost: 1200, costPerEmployee: 600, departmentTotal: 1800, employeeCount: 3 },
];

export const DEMO_EXCEPTIONS: ExceptionRow[] = [
  { type: 'unresolved-location', description: 'Employee has no resolved drop-off destination', employeeNo: 'EMP-1009', employeeName: 'Aruni Dissanayake', severity: 'high', requestCode: 'REQ-2026-0044' },
  { type: 'overflow', description: 'VAN capacity exceeded by 2 passengers', groupCode: 'GRP-D4', severity: 'medium', requestCode: 'REQ-2026-0045' },
  { type: 'unassigned', description: 'Group has no vehicle assigned', groupCode: 'GRP-E5', severity: 'high', requestCode: 'REQ-2026-0044' },
  { type: 'warning', description: 'Driver license expires in 7 days', severity: 'low', requestCode: 'REQ-2026-0042' },
];

export const DEMO_ARCHIVE: ArchiveReportRow[] = [
  { requestCode: 'REQ-2026-0038', requestDate: '2026-03-10', closedDate: '2026-03-11', departmentName: 'Engineering', totalEmployees: 8, totalGroups: 3, totalVehicles: 2, finalStatus: 'CLOSED' },
  { requestCode: 'REQ-2026-0035', requestDate: '2026-03-07', closedDate: '2026-03-08', departmentName: 'Operations', totalEmployees: 12, totalGroups: 4, totalVehicles: 3, finalStatus: 'ARCHIVED' },
  { requestCode: 'REQ-2026-0030', requestDate: '2026-03-01', closedDate: '2026-03-02', departmentName: 'Engineering', totalEmployees: 6, totalGroups: 2, totalVehicles: 2, finalStatus: 'ARCHIVED' },
];
