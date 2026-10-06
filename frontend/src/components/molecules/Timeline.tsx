import { CheckCircle2, Clock, XCircle, PlusCircle, FileCheck, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { AttachmentList, AttachmentItem } from '@/components/molecules/AttachmentList';

export interface TimelineStep {
    id: number;
    name: string;
    assigned_to_name: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISED' | 'SKIPPED' | 'ADDITIONAL';
    comments?: string;
    acted_at?: string;
    step_order: number;
    role_name: string;
    step_data?: Record<string, any>;
}

interface TimelineProps {
    steps: TimelineStep[];
    currentStep: number;
}

const getStepAttachments = (stepData?: Record<string, any>): AttachmentItem[] => {
    if (!stepData) return [];
    const files: AttachmentItem[] = [];
    let counter = 1;

    const extract = (val: any) => {
        if (!val) return;
        if (Array.isArray(val)) {
            val.forEach(extract);
            return;
        }
        if (typeof val === 'object' && val !== null) {
            if (val.name || val.data || val.url) {
                files.push({
                    id: `step-att-${counter++}`,
                    name: val.name || `Attachment-${counter}`,
                    size: val.size,
                    type: val.type,
                    data: val.data,
                    url: val.url,
                });
            }
        } else if (typeof val === 'string' && (val.startsWith('data:') || val.startsWith('http') || val.startsWith('/media/'))) {
            files.push({
                id: `step-att-${counter++}`,
                name: `Step File-${counter}`,
                data: val.startsWith('data:') ? val : undefined,
                url: !val.startsWith('data:') ? val : undefined,
            });
        }
    };

    if (stepData.quotation) extract(stepData.quotation);
    if (stepData.attachments) extract(stepData.attachments);
    if (stepData.files) extract(stepData.files);

    return files;
};

export const Timeline = ({ steps, currentStep }: TimelineProps) => {
    return (
        <div className="space-y-4">
            {steps.map((step, index) => {
                const isCompleted = step.status === 'APPROVED';
                const isCurrent = step.status === 'PENDING' && step.step_order === currentStep;
                const isRejected = step.status === 'REJECTED';
                const isSkipped = step.status === 'SKIPPED';
                const isAdditional = step.status === 'ADDITIONAL';
                const isPast = step.step_order < currentStep;

                const stepAttachments = getStepAttachments(step.step_data);
                const poNumber = step.step_data?.po_number;
                const quotationText = typeof step.step_data?.quotation === 'string' && !step.step_data?.quotation.startsWith('data:') ? step.step_data?.quotation : null;

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
                            ) : isAdditional ? (
                                <PlusCircle className="text-slate-300" size={20} />
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
                                    isCurrent ? "text-blue-600" : isAdditional ? "text-blue-600" : "text-slate-900"
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
                                        {step.status === 'APPROVED' ? 'Approved by' : step.status === 'REJECTED' ? 'Rejected by' : step.status === 'PENDING' ? 'Pending' : step.status === 'ADDITIONAL' ? 'Additional Action' : 'Waiting for'}: <span className={isSkipped ? "text-slate-400" : "text-slate-700"}>{step.assigned_to_name}</span>
                                    </>
                                ) : (
                                    <>
                                        Assigned to <span className={isSkipped ? "text-slate-400" : "text-slate-700"}>{step.role_name}</span>
                                    </>
                                )}
                            </p>

                            {/* Additional Step Metadata (PO Number / Quotation No) */}
                            {(poNumber || quotationText) && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {poNumber && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium text-xs border border-blue-100">
                                            <Tag size={12} />
                                            PO No: <strong className="font-bold">{poNumber}</strong>
                                        </span>
                                    )}
                                    {quotationText && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium text-xs border border-emerald-100">
                                            <FileCheck size={12} />
                                            Quotation Ref: <strong className="font-bold">{quotationText}</strong>
                                        </span>
                                    )}
                                </div>
                            )}

                            {step.comments && (
                                <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100 italic">
                                    "{step.comments}"
                                </div>
                            )}

                            {/* Step Attachment Files */}
                            {stepAttachments.length > 0 && (
                                <div className="mt-3">
                                    <AttachmentList attachments={stepAttachments} compact />
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

