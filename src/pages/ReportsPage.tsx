import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReportFiltersBar from '@/components/reports/ReportFiltersBar';
import ReportTypeSelector from '@/components/reports/ReportTypeSelector';
import ReportReadinessBadge from '@/components/reports/ReportReadinessBadge';
import RouteWiseReportView from '@/components/reports/RouteWiseReportView';
import VehicleWiseReportView from '@/components/reports/VehicleWiseReportView';
import DepartmentSummaryReportView from '@/components/reports/DepartmentSummaryReportView';
import GroupingReportView from '@/components/reports/GroupingReportView';
import DispatchManifestView from '@/components/reports/DispatchManifestView';
import CostSummaryView from '@/components/reports/CostSummaryView';
import ExceptionReportView from '@/components/reports/ExceptionReportView';
import ArchiveReportsView from '@/components/reports/ArchiveReportsView';
import api from '@/lib/api';
import type { ReportType, ReportFilters, ReportReadiness, ReportMeta } from '@/types/reports';
import type { Role } from '@/types/auth';
import {
  Printer, Download, FileText, BarChart3, Info, Eye, Loader2, ShieldAlert, AlertCircle,
} from 'lucide-react';

// ── Role-based access ──
const ROLE_REPORTS: Record<Role, ReportType[]> = {
  SUPER_ADMIN: ['route-wise', 'vehicle-wise', 'department-summary', 'grouping', 'dispatch-manifest', 'cost-summary', 'exception', 'archive'],
  ADMIN: ['route-wise', 'vehicle-wise', 'department-summary', 'grouping', 'dispatch-manifest', 'cost-summary', 'exception', 'archive'],
  HOD: ['route-wise', 'department-summary'],
  HR: ['department-summary', 'dispatch-manifest', 'cost-summary'],
  TRANSPORT_AUTHORITY: ['route-wise', 'vehicle-wise', 'grouping', 'dispatch-manifest', 'exception'],
  PLANNING: ['department-summary', 'cost-summary', 'archive'],
  EMP: [],
};

function ReportWorkflowHelp() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> {t('reports.howReportsWork')}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <p className="font-semibold text-foreground text-xs">{t('reports.reportWorkflow')}</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>{t('reportsHelp.step1')}</li>
              <li>{t('reportsHelp.step2')}</li>
              <li>{t('reportsHelp.step3')}</li>
              <li>{t('reportsHelp.step4')}</li>
              <li>{t('reportsHelp.step5')}</li>
              <li>{t('reportsHelp.step6')}</li>
              <li>{t('reportsHelp.step7')}</li>
              <li>{t('reportsHelp.step8')}</li>
            </ol>
          </div>
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <p className="font-semibold text-foreground text-xs">{t('reports.dataSources')}</p>
            <ul className="space-y-0.5">
              <li>• {t('reportsHelp.dataSource1')}</li>
              <li>• {t('reportsHelp.dataSource2')}</li>
              <li>• {t('reportsHelp.dataSource3')}</li>
              <li>• {t('reportsHelp.dataSource4')}</li>
              <li>• {t('reportsHelp.dataSource5')}</li>
            </ul>
          </div>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5 text-[11px]">
          <p className="font-semibold text-foreground mb-1">{t('reports.reportAvailability')}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span>LOCKED</span><span>→ {t('reportsHelp.statusLocked')}</span>
            <span>GROUPED</span><span>→ {t('reportsHelp.statusGrouped')}</span>
            <span>ASSIGNING</span><span>→ {t('reportsHelp.statusAssigning')}</span>
            <span className="font-semibold text-foreground">READY / DISPATCHED</span><span className="font-semibold text-foreground">→ ● {t('reportsHelp.statusReady')}</span>
            <span>CLOSED / ARCHIVED</span><span>→ {t('reportsHelp.statusClosed')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role ?? 'EMP';
  const printRef = useRef<HTMLDivElement>(null);

  const allowedTypes = useMemo(() => ROLE_REPORTS[role] || [], [role]);
  const [selectedType, setSelectedType] = useState<ReportType>(() => allowedTypes[0] || 'route-wise');
  const [filters, setFilters] = useState<ReportFilters>(() => ({ date: getToday() }));
  const [tab, setTab] = useState<'reports' | 'help'>('reports');
  const [reportData, setReportData] = useState<any>(null);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Bug fix #1: React to role changes — auto-correct selectedType if not allowed
  useEffect(() => {
    if (allowedTypes.length > 0 && !allowedTypes.includes(selectedType)) {
      setSelectedType(allowedTypes[0]);
    }
  }, [allowedTypes, selectedType]);

  const hasData = reportData && Array.isArray(reportData) && reportData.length > 0;
  // Trust backend readiness — strict HR-final gating
  const readiness: ReportReadiness = meta?.readiness ?? 'unavailable';
  const canExport = readiness === 'ready' || readiness === 'archived';
  const isPreview = readiness === 'preview';
  const isBlocked = !canExport && !isPreview && readiness !== 'unavailable';

  const fetchReport = useCallback(async () => {
    if (!allowedTypes.includes(selectedType)) return;
    setLoading(true);
    setFetchError(null);
    try {
      const params: any = {};
      if (filters.date) params.date = filters.date;
      const res = await api.get(`/reports/${selectedType}`, { params });
      const d = res.data?.data ?? res.data;
      setReportData(d?.rows || d?.data || []);
      setMeta(d?.meta || null);
    } catch (err: any) {
      console.error('[ReportsPage] fetch error:', err);
      setReportData([]);
      setMeta(null);
      setFetchError(err?.response?.data?.message || err?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [selectedType, filters, allowedTypes]);

  useEffect(() => {
    if (allowedTypes.includes(selectedType)) {
      fetchReport();
    }
  }, [fetchReport, selectedType]);

  // Bug fix #3: Print only report content
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportPdf = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadSummary = useCallback(() => {
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) return;
    const keys = Object.keys(reportData[0]);
    const csvRows = [
      keys.join(','),
      ...reportData.map((row: any) =>
        keys.map(k => {
          const val = row[k];
          if (val == null) return '';
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedType}-report-${filters.date || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reportData, selectedType, filters.date]);

  // Bug fix #4: Reset preserves current date (never clears to empty)
  const resetFilters = useCallback(() => {
    setFilters({ date: filters.date || getToday() });
  }, [filters.date]);

  // EMP sees limited view
  if (role === 'EMP') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('reports.myTransportDetails')}</h1>
          <p className="text-sm text-muted-foreground">{t('reports.myTransportSubtitle')}</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">{t('reports.personalTransport')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('reports.personalTransportDesc')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap no-print">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            {t('reports.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('reports.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ReportReadinessBadge readiness={readiness} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as 'reports' | 'help')}>
        <TabsList className="no-print">
          <TabsTrigger value="reports" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> {t('reports.reportsTab')}</TabsTrigger>
          <TabsTrigger value="help" className="gap-1.5"><Info className="h-3.5 w-3.5" /> {t('reports.howItWorksTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="help" className="mt-4 no-print">
          <ReportWorkflowHelp />
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="no-print">
            <ReportFiltersBar filters={filters} onChange={setFilters} onReset={resetFilters} />
          </div>

          {/* Type selector — bug fix #2: only show allowed types */}
          <div className="no-print">
            <ReportTypeSelector
              selected={selectedType}
              onChange={t => allowedTypes.includes(t) && setSelectedType(t)}
              allowedTypes={allowedTypes}
            />
          </div>

          {/* Access restriction notice */}
          {allowedTypes.length === 0 && (
            <Card className="no-print">
              <CardContent className="py-8 text-center">
               <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-medium text-foreground">{t('reports.accessRestricted')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('reports.noPermission')}</p>
              </CardContent>
            </Card>
          )}

          {/* Preview mode banner */}
          {isPreview && (
            <div className="no-print flex items-center gap-2 rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-3 text-xs text-[hsl(var(--warning))]">
              <Eye className="h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">{t('reports.previewMode')}</span>
                {t('reports.previewDesc')}
              </span>
            </div>
          )}

          {/* Blocked banner — awaiting grouping / assignment / HR */}
          {isBlocked && hasData && (
            <div className="no-print flex items-center gap-2 rounded-lg border border-[hsl(var(--info))]/30 bg-[hsl(var(--info))]/5 p-3 text-xs text-[hsl(var(--info))]">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">{t('reportsHelp.reportsLocked')} </span>
                {t('reportsHelp.reportsLockedDesc', { status: meta?.workflowStatus || t('common.pending') })}
              </span>
            </div>
          )}

          {/* Fetch error banner — bug fix #15 */}
          {fetchError && !loading && (
            <div className="no-print flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}

          {/* Awaiting HR approval banner */}
          {!loading && !fetchError && readiness === 'awaiting-hr-approval' && hasData && (
            <div className="no-print flex items-center gap-2 rounded-lg border border-[hsl(var(--info))]/30 bg-[hsl(var(--info))]/5 p-3 text-xs text-[hsl(var(--info))]">
              <Info className="h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">{t('reportsHelp.awaitingHr')} </span>
                {t('reportsHelp.awaitingHrDesc')}
              </span>
            </div>
          )}

          {/* Unavailable / empty banner */}
          {!loading && !fetchError && !hasData && readiness === 'unavailable' && (
            <div className="no-print flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              <span>{t('reportsHelp.noDataForDate')}</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="no-print flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Export actions */}
          {allowedTypes.length > 0 && (
            <div className="no-print flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={handlePrint} disabled={!hasData || isBlocked} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                {isPreview ? t('reports.printPreview') : t('reports.printPdf')}
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={!hasData || isBlocked} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> {t('reports.exportPdf')}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadSummary} disabled={!hasData || isBlocked} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> {t('reports.downloadSummary')}
              </Button>
              {isBlocked && hasData && (
                <span className="text-[11px] text-muted-foreground ml-2">
                  {t('reports.finalPdfNote')}
                </span>
              )}
            </div>
          )}

          {/* Report preview panel */}
          {!loading && hasData && allowedTypes.includes(selectedType) && (
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-6 print:p-0" ref={printRef}>
                {selectedType === 'route-wise' && <RouteWiseReportView data={reportData} meta={meta!} />}
                {selectedType === 'vehicle-wise' && <VehicleWiseReportView data={reportData} meta={meta!} />}
                {selectedType === 'department-summary' && <DepartmentSummaryReportView data={reportData} meta={meta!} />}
                {selectedType === 'grouping' && <GroupingReportView data={reportData} meta={meta!} />}
                {selectedType === 'dispatch-manifest' && <DispatchManifestView data={reportData} meta={meta!} />}
                {selectedType === 'cost-summary' && <CostSummaryView data={reportData} meta={meta!} />}
                {selectedType === 'exception' && <ExceptionReportView data={reportData} meta={meta!} />}
                {selectedType === 'archive' && <ArchiveReportsView data={reportData} meta={meta!} />}
              </CardContent>
            </Card>
          )}

          {/* Empty data state (not loading, data fetched but empty, not unavailable) — bug fix #15 */}
          {!loading && !fetchError && readiness !== 'unavailable' && !hasData && allowedTypes.includes(selectedType) && (
            <Card className="no-print">
              <CardContent className="py-10 text-center">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="font-medium text-foreground text-sm">{t('common.noData')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('reports.noReportData')}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
