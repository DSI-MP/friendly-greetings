import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/transport/StatusBadge';
import { Calendar, Building2, Users, FileText, Clock } from 'lucide-react';
import type { RequestDetail } from '@/types/workflow';

interface Props {
  request: RequestDetail;
  onClick?: () => void;
  compact?: boolean;
}

export default function RequestSummaryCard({ request, onClick, compact }: Props) {
  const deptName = request.department_name
    || request.department?.name
    || `Dept ${request.department_id}`;

  return (
    <Card
      className={`transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <CardContent className={compact ? 'p-4' : 'p-5'}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">
                REQ-{String(request.id).padStart(4, '0')}
              </span>
              <StatusBadge status={request.status} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />{request.request_date}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />{deptName}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {request.employee_count ?? request.employees?.length ?? '—'} employees
              </span>
              {request.ot_time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />OT: {request.ot_time}
                </span>
              )}
            </div>
            {!compact && request.notes && (
              <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{request.notes}</span>
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
