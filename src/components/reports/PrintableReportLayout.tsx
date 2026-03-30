import type { ReactNode } from 'react';
import type { ReportMeta } from '@/types/reports';
import ReportReadinessBadge from './ReportReadinessBadge';

interface Props {
  meta: ReportMeta;
  children: ReactNode;
}

/**
 * A4-friendly printable wrapper.
 * On screen: renders inside the preview panel.
 * On print: fills A4 with proper margins, headers, footers.
 */
export default function PrintableReportLayout({ meta, children }: Props) {
  return (
    <div className="print-report">
      {/* Screen + Print header */}
      <div className="mb-6 border-b border-border pb-4 print:border-b print:border-black print:pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-foreground print:text-black">{meta.title}</h2>
            {meta.requestCode && (
              <p className="text-sm text-muted-foreground print:text-gray-600">
                Request: <span className="font-semibold text-foreground print:text-black">{meta.requestCode}</span>
              </p>
            )}
            {meta.department && (
              <p className="text-xs text-muted-foreground print:text-gray-600">Department: {meta.department}</p>
            )}
            {meta.requestDate && (
              <p className="text-xs text-muted-foreground print:text-gray-600">Date: {meta.requestDate}</p>
            )}
          </div>
          <div className="text-right space-y-1">
            <div className="print:hidden">
              <ReportReadinessBadge readiness={meta.readiness} />
            </div>
            <p className="hidden print:block text-xs text-gray-600 font-semibold">
              {meta.readiness === 'ready' ? '● FINAL APPROVED' : meta.readiness === 'preview' ? '● PREVIEW' : meta.readiness === 'archived' ? '● ARCHIVED' : ''}
            </p>
            <p className="text-[10px] text-muted-foreground print:text-gray-500">
              Status: {meta.workflowStatus}
            </p>
            <p className="text-[10px] text-muted-foreground print:text-gray-500">
              Generated: {new Date(meta.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Report content */}
      <div className="print:text-sm">{children}</div>

      {/* Print footer — bug fix #16: branding */}
      <div className="hidden print:block mt-8 border-t border-gray-300 pt-2 text-[9px] text-gray-500">
        <div className="flex justify-between">
          <span>Created by P.C.U Technical Team / W.O. Sandaruwan Jayalath</span>
          <span>{meta.readiness === 'ready' ? 'Final Approved Report' : meta.readiness === 'preview' ? 'PREVIEW — Subject to Change' : 'Report'}</span>
        </div>
      </div>
    </div>
  );
}
