// ── Report Types & Interfaces ──

export type ReportType =
  | 'route-wise'
  | 'vehicle-wise'
  | 'department-summary'
  | 'grouping'
  | 'dispatch-manifest'
  | 'cost-summary'
  | 'exception'
  | 'archive';

export type ReportReadiness =
  | 'ready'
  | 'preview'
  | 'awaiting-grouping'
  | 'awaiting-assignment'
  | 'awaiting-hr-approval'
  | 'archived'
  | 'unavailable';

export interface ReportFilters {
  date?: string;
}

export interface RouteWiseRow {
  requestCode: string;
  requestDate: string;
  routeName: string;
  groupCode: string;
  employeeNo?: string;
  employeeName: string;
  destination: string;
  vehicleReg: string;
  driverName: string;
  driverPhone: string;
  status: string;
  stopSequence?: number;
  stops?: string[];
}

export interface VehicleWiseRow {
  vehicleReg: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
  groupCodes: string[];
  employees: { empNo?: string; name: string }[];
  capacity: number;
  occupancy: number;
  overflow: boolean;
}

export interface DepartmentSummaryRow {
  departmentName: string;
  totalEmployees: number;
  assignedEmployees: number;
  unassignedEmployees: number;
  approvedStatus: string;
  requestStatus: string;
  requestCode: string;
  reportReady: boolean;
}

export interface GroupingReportRow {
  groupCode: string;
  routeCorridor: string;
  memberCount: number;
  clusterNote: string;
  recommendedVehicle: string;
  assignedVehicle: string;
  driverName: string;
  overflowWarning: boolean;
  recommendationReason: string;
}

export interface DispatchManifestRow {
  requestDate: string;
  groupCode: string;
  vehicleReg: string;
  driverName: string;
  driverPhone: string;
  employees: { empNo?: string; name: string; destination: string; sequence: number }[];
  notes: string;
}

export interface CostSummaryRow {
  routeGroup: string;
  estimatedDistanceKm: number;
  estimatedCost: number;
  vehicleCost: number;
  costPerEmployee: number;
  departmentTotal: number;
  employeeCount: number;
}

export interface ExceptionRow {
  type: 'unresolved-location' | 'overflow' | 'unassigned' | 'warning' | 'rejected';
  description: string;
  groupCode?: string;
  employeeNo?: string;
  employeeName?: string;
  severity: 'high' | 'medium' | 'low';
  requestCode: string;
}

export interface ArchiveReportRow {
  requestCode: string;
  requestDate: string;
  closedDate: string;
  departmentName: string;
  totalEmployees: number;
  totalGroups: number;
  totalVehicles: number;
  finalStatus: string;
}

export interface ReportMeta {
  title: string;
  requestCode?: string;
  generatedAt: string;
  requestDate?: string;
  department?: string;
  route?: string;
  vehicle?: string;
  workflowStatus: string;
  readiness: ReportReadiness;
}
