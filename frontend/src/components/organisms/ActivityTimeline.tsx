import {
  CheckCircle,
  XCircle,
  RotateCcw,
  Eye,
  Plus,
  MessageSquare,
  User as UserIcon,
  Clock,
  History
} from 'lucide-react';
// import { formatDistanceToNow } from 'date-fns';
// import { id } from 'date-fns/locale';
import { formatDate } from '@/lib/utils';

interface AuditLog {
  id: number;
  action: string;
  actor: number;
  actor_name: string;
  details: string;
  timestamp: string;
}

interface ActivityTimelineProps {
  logs: AuditLog[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ logs }) => {
  // Map actions to icons and colors
  const getActionConfig = (action: string) => {
    switch (action) {
      case 'APPROVED':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          bgColor: 'bg-emerald-50',
          iconColor: 'text-emerald-600',
          borderColor: 'border-emerald-200'
        };
      case 'REJECTED':
        return {
          icon: <XCircle className="w-5 h-5" />,
          bgColor: 'bg-rose-50',
          iconColor: 'text-rose-600',
          borderColor: 'border-rose-200'
        };
      case 'REVISED':
        return {
          icon: <RotateCcw className="w-5 h-5" />,
          bgColor: 'bg-amber-50',
          iconColor: 'text-amber-600',
          borderColor: 'border-amber-200'
        };
      case 'WATCHER_ADDED':
        return {
          icon: <Eye className="w-5 h-5" />,
          bgColor: 'bg-sky-50',
          iconColor: 'text-sky-600',
          borderColor: 'border-sky-200'
        };
      case 'SUBMITTED':
        return {
          icon: <Plus className="w-5 h-5" />,
          bgColor: 'bg-slate-50',
          iconColor: 'text-slate-600',
          borderColor: 'border-slate-200'
        };
      case 'FEEDBACK':
        return {
          icon: <MessageSquare className="w-5 h-5" />,
          bgColor: 'bg-indigo-50',
          iconColor: 'text-indigo-600',
          borderColor: 'border-indigo-200'
        };
      default:
        return {
          icon: <MessageSquare className="w-5 h-5" />,
          bgColor: 'bg-slate-50',
          iconColor: 'text-slate-500',
          borderColor: 'border-slate-200'
        };
    }
  };

  // Sort logs by timestamp descending
  const sortedLogs = [...logs].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
        <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm font-medium">No Activity Log</p>
      </div>
    );
  }

  return (
    <div className="flow-root p-1">
      <ul role="list" className="-mb-8">
        {sortedLogs.map((log, logIdx) => {
          const config = getActionConfig(log.action);

          return (
            <li key={log.id}>
              <div className="relative pb-8">
                {logIdx !== sortedLogs.length - 1 ? (
                  <span
                    className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-100"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex items-start space-x-4">
                  <div className="relative">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${config.bgColor} ${config.iconColor} border ${config.borderColor} shadow-sm transition-all duration-200 hover:scale-110`}>
                      {config.icon}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <span className="p-1 rounded bg-gray-100">
                          <UserIcon className="w-3 h-3 text-gray-500" />
                        </span>
                        {log.actor_name}
                      </div>
                      <p className="text-[11px] font-medium text-gray-400 flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                        <Clock className="w-3 h-3 text-gray-500" />
                        {formatDate(log.timestamp)}
                      </p>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <p className="leading-relaxed">{log.details || log.action}</p>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
