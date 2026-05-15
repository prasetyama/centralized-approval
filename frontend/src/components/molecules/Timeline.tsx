import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

export interface TimelineStep {
    id: number;
    name: string;
    assigned_to_name: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISED' | 'SKIPPED';
    comments?: string;
    acted_at?: string;
    step_order: number;
    role_name: string;
}

interface TimelineProps {
    steps: TimelineStep[];
    currentStep: number;
}

export const Timeline = ({ steps, currentStep }: TimelineProps) => {
    return (
        <div className="space-y-4">
            {steps.map((step, index) => {
                const isCompleted = step.status === 'APPROVED';
                const isCurrent = step.status === 'PENDING' && step.step_order === currentStep;
                const isRejected = step.status === 'REJECTED';
                const isSkipped = step.status === 'SKIPPED';
                const isPast = step.step_order < currentStep;

                return (
                    <div key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
                        {/* Line */}
                        {index < steps.length - 1 && (
                            <div
                                className={cn(
                                    "absolute left-[15px] top-8 h-[calc(100%-16px)] w-0.5",
                                    isPast || isCompleted ? "bg-emerald-500" : "bg-slate-200"
                                )}
                            />
                        )}

                        {/* Icon */}
                        <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-white">
                            {isCompleted ? (
                                <CheckCircle2 className="text-emerald-500" size={20} />
                            ) : isRejected ? (
                                <XCircle className="text-red-500" size={20} />
                            ) : isSkipped ? (
                                <XCircle className="text-red-500" size={20} />
                            ) : isCurrent ? (
                                <div className="h-3 w-3 rounded-full bg-blue-600 animate-pulse" />
                            ) : (
                                <Clock className="text-slate-300" size={20} />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1">
                            <div className="flex items-center justify-between">
                                <p className={cn(
                                    "font-semibold text-sm",
                                    isCurrent ? "text-blue-600" : isSkipped ? "text-slate-400" : "text-slate-900"
                                )}>
                                    {step.name}
                                </p>
                                {step.acted_at && (
                                    <span className="text-xs text-slate-400">
                                        {step.status.toString().replace('_', ' ').toLowerCase() + ' at ' + formatDate(step.acted_at)}
                                    </span>
                                )}
                            </div>
                            <p className={cn(
                                "text-xs font-medium",
                                isSkipped ? "text-slate-300" : "text-slate-500"
                            )}>
                                {isSkipped ? (
                                    "System skipped"
                                ) : step.assigned_to_name ? (
                                    <>
                                        {step.status === 'APPROVED' ? 'Approved by' : step.status === 'REJECTED' ? 'Rejected by' : step.status === 'PENDING' ? 'Pending' : 'Waiting for'}: <span className={isSkipped ? "text-slate-400" : "text-slate-700"}>{step.assigned_to_name}</span>
                                    </>
                                ) : (
                                    <>
                                        Assigned to <span className={isSkipped ? "text-slate-400" : "text-slate-700"}>{step.role_name}</span>
                                    </>
                                )}
                            </p>

                            {step.comments && (
                                <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100 italic">
                                    "{step.comments}"
                                </div>
                            )}

                            {isCurrent && (
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100 uppercase tracking-wider">
                                    Current Action
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
