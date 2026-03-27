import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Share2, Printer, MoreVertical, Clock, History } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/atoms/Card';
import { PayloadRenderer } from '@/components/molecules/PayloadRenderer';
import { Timeline } from '@/components/molecules/Timeline';
import { ActionButtons } from '@/components/molecules/ActionButtons';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/utils';

export const ApprovalDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { data: request, isLoading } = useQuery({
        queryKey: ['workflow-detail', id],
        queryFn: () => api.get(`/workflow/${id}`),
    });

    const actionMutation = useMutation({
        mutationFn: ({ action, comments }: { action: string, comments: string }) =>
            api.post(`/workflow/${id}/${action}`, { comments }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workflow-detail', id] });
            queryClient.invalidateQueries({ queryKey: ['inbox'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
        },
    });

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'success';
            case 'REJECTED': return 'error';
            case 'IN_PROGRESS': return 'info';
            case 'REVISED': return 'warning';
            default: return 'outline';
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 text-center text-slate-500 animate-pulse">
                <div className="h-8 w-48 bg-slate-200 rounded mx-auto mb-8"></div>
                <div className="grid grid-cols-3 gap-8">
                    <div className="col-span-2 h-[600px] bg-slate-100 rounded-xl"></div>
                    <div className="h-[600px] bg-slate-100 rounded-xl"></div>
                </div>
            </div>
        );
    }

    const detail = request as any;
    if (!detail) return null;

    const isApprover = detail?.steps?.some((s: any) =>
        s.step_order === detail.current_step &&
        s.assigned_to === user?.id &&
        detail.status === 'IN_PROGRESS'
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-900">{detail.title}</h1>
                            <Badge variant={getStatusVariant(detail.status)}>{detail.status}</Badge>
                        </div>
                        <p className="text-sm text-slate-500 font-medium">
                            Reference: <span className="text-slate-900 font-bold">{detail.reference_id}</span> •
                            Submitted {formatDate(detail.created_at)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon"><Share2 size={18} /></Button>
                    <Button variant="outline" size="icon"><Printer size={18} /></Button>
                    <Button variant="outline" size="icon"><MoreVertical size={18} /></Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <PayloadRenderer
                        moduleCode={detail.module_code}
                        payload={detail.payload}
                    />

                    <Card className="border-slate-100 bg-white shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center gap-3">
                            <History size={18} className="text-slate-400" />
                            <CardTitle className="text-base uppercase tracking-wider text-slate-500 font-bold">Request Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Requester</p>
                                        <p className="text-sm font-semibold text-slate-900">{detail.requester_name}</p>
                                        <p className="text-xs text-slate-500">{detail.requester_email}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Module Source</p>
                                        <p className="text-sm font-semibold text-slate-900">{detail.module_name}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Location</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Clock size={14} className="text-blue-500" />
                                            <p className="text-sm font-bold text-blue-700">Step {detail.current_step} of {detail.workflow_name}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Priority</p>
                                        <Badge variant={detail.priority === 'URGENT' ? 'error' : 'secondary'}>{detail.priority}</Badge>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 pt-8 border-t border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Internal Description</p>
                                <p className="text-sm text-slate-600 leading-relaxed italic">
                                    {detail.description || 'No description provided.'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-8">
                    <Card className="shadow-lg border-slate-100 bg-white">
                        <CardHeader className="border-b border-slate-100 pb-4">
                            <CardTitle className="text-lg">Approval Timeline</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <Timeline
                                steps={detail.steps}
                                currentStep={detail.current_step}
                            />
                        </CardContent>
                    </Card>

                    <ActionButtons
                        onApprove={async (comments) => { await actionMutation.mutateAsync({ action: 'approve', comments }); }}
                        onReject={async (comments) => { await actionMutation.mutateAsync({ action: 'reject', comments }); }}
                        onRevise={async (comments) => { await actionMutation.mutateAsync({ action: 'revise', comments }); }}
                        isLoading={actionMutation.isPending}
                        canAction={isApprover === true}
                    />

                    {!isApprover && detail.status === 'IN_PROGRESS' && (
                        <div className="rounded-xl bg-blue-50/50 p-4 border border-blue-100 text-sm text-blue-700 font-medium flex gap-3">
                            <Clock size={18} className="shrink-0" />
                            <p>This request is currently with another approver. You can take action when it reaches your step.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
