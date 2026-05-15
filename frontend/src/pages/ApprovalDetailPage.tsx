import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, History } from 'lucide-react';
import { useState } from 'react';
import api from '@/services/api';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/atoms/Card';
import { PayloadRenderer } from '@/components/molecules/PayloadRenderer';
import { Timeline } from '@/components/molecules/Timeline';
import { ActionButtons } from '@/components/molecules/ActionButtons';
import { DelegateModal } from '@/components/molecules/DelegateModal';
import { FeedbackList } from '@/components/molecules/FeedbackList';
import { FeedbackForm } from '@/components/molecules/FeedbackForm';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/utils';
import { MessageSquare, ListTodo, Eye, Plus, AlertCircle } from 'lucide-react';
import { AddWatcherModal } from '@/components/molecules/AddWatcherModal';
import { ConfirmationModal } from '@/components/molecules/ConfirmationModal';
import { WatcherAvatarGroup } from '@/components/molecules/WatcherAvatarGroup';
import { ActivityTimeline } from '@/components/organisms/ActivityTimeline';

export const ApprovalDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
    const [isAddWatcherModalOpen, setIsAddWatcherModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [watcherToRemove, setWatcherToRemove] = useState<{ id: number, name: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'timeline' | 'activity' | 'discussion'>('timeline');
    const { data: request, isLoading, isError } = useQuery({
        queryKey: ['workflow-detail', id],
        queryFn: () => api.get(`/workflow/${id}`),
        retry: false,
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

    const delegateMutation = useMutation({
        mutationFn: ({ new_assignee_id, comments }: { new_assignee_id: number, comments: string }) =>
            api.post(`/workflow/${id}/delegate`, { new_assignee_id, comments }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workflow-detail', id] });
            queryClient.invalidateQueries({ queryKey: ['inbox'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
            setIsDelegateModalOpen(false);
        },
    });

    const feedbackMutation = useMutation({
        mutationFn: ({ content, mentionedUserId }: { content: string, mentionedUserId: number | null }) =>
            api.post(`/feedback/`, { request: id, content, user: mentionedUserId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workflow-detail', id] });
        },
    });

    const addWatcherMutation = useMutation({
        mutationFn: (userId: number) =>
            api.post(`/workflow/${id}/watchers`, { user_id: userId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workflow-detail', id] });
            setIsAddWatcherModalOpen(false);
        },
    });

    const removeWatcherMutation = useMutation({
        mutationFn: (watcherId: number) =>
            api.delete(`/workflow/watchers/remove`, { data: { watcher_id: watcherId } }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workflow-detail', id] });
            setIsConfirmModalOpen(false);
            setWatcherToRemove(null);
        },
        onError: (error) => {
            alert(error);
        },
    });

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'success';
            case 'REJECTED': return 'error';
            case 'IN_PROGRESS': return 'info';
            default: return 'outline';
        }
    };

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in duration-500">
                <div className="p-6 rounded-full bg-red-50 text-red-600 mb-6 ring-8 ring-red-50/50">
                    <AlertCircle size={48} />
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">Access Denied</h2>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => navigate(-1)} className="font-bold px-8 h-12 rounded-xl">
                        Go Back
                    </Button>
                    <Button onClick={() => window.location.reload()} className="bg-slate-900 text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-slate-200">
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

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
        s.role_required === user?.role &&
        detail.status === 'IN_PROGRESS'
    );

    const isWatcher = detail?.watchers?.some((w: any) => w.user === user?.id);

    const activeStep = detail?.steps?.find((s: any) => s.step_order === detail.current_step);

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
                <div className="flex items-center gap-6 flex-row">
                    {/* {user?.is_superuser && detail.status === 'IN_PROGRESS' && (
                        <Button
                            variant="outline"
                            className="bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100 hover:text-purple-700 font-bold"
                            onClick={() => setIsDelegateModalOpen(true)}
                        >
                            <User size={18} className="mr-2" />
                            Delegate Task
                        </Button>
                    )} */}

                    {detail.watchers?.length > 0 && (
                        <WatcherAvatarGroup
                            watchers={detail.watchers}
                            onRemove={(watcher) => {
                                setWatcherToRemove(watcher);
                                setIsConfirmModalOpen(true);
                            }}
                        />
                    )}

                    {!isWatcher && <Button
                        variant="outline"
                        className="bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 hover:text-indigo-700 font-bold"
                        onClick={() => setIsAddWatcherModalOpen(true)}
                    >
                        <Plus size={18} className="mr-2" />
                        Add Watcher
                    </Button>
                    }
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
                        <CardContent className="p-6 mb-6">
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
                    <Card className="shadow-lg border-slate-100 bg-white overflow-hidden">
                        <div className="flex border-b border-slate-100">
                            <button
                                onClick={() => setActiveTab('timeline')}
                                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'timeline'
                                    ? 'text-indigo-600 bg-indigo-50/30 border-b-2 border-indigo-600'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <ListTodo size={18} />
                                Approvals
                            </button>
                            <button
                                onClick={() => setActiveTab('discussion')}
                                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${activeTab === 'discussion'
                                    ? 'text-indigo-600 bg-indigo-50/30 border-b-2 border-indigo-600'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <MessageSquare size={18} />
                                Discussion
                                {detail.feedbacks?.length > 0 && (
                                    <span className="absolute top-3 right-4 bg-indigo-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                        {detail.feedbacks.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('activity')}
                                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${activeTab === 'activity'
                                    ? 'text-indigo-600 bg-indigo-50/30 border-b-2 border-indigo-600'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <History size={18} />
                                Activity Log
                            </button>
                        </div>
                        <CardContent className="p-0">
                            {activeTab === 'timeline' ? (
                                <div className="p-6 max-h-[500px] overflow-y-auto">
                                    <Timeline
                                        steps={detail.steps}
                                        currentStep={detail.current_step}
                                    />
                                </div>
                            ) : activeTab === 'activity' ? (
                                <div className="p-6 max-h-[500px] overflow-y-auto bg-slate-50/30">
                                    <ActivityTimeline
                                        logs={detail.audit_logs || []}
                                    />
                                </div>
                            ) : (
                                <div className="p-6 space-y-8">
                                    <FeedbackForm
                                        onSubmit={async (content, mentionedUserId) => { await feedbackMutation.mutateAsync({ content, mentionedUserId }); }}
                                        isLoading={feedbackMutation.isPending}
                                    />
                                    <div className="pt-6 border-t border-slate-100 max-h-[400px] overflow-y-auto">
                                        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            Feedback
                                            <Badge variant="secondary" className="rounded-full h-5 min-w-[20px] flex items-center justify-center p-0">
                                                {detail.feedbacks?.length || 0}
                                            </Badge>
                                        </h3>
                                        <FeedbackList
                                            feedbacks={detail.feedbacks || []}
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <ActionButtons
                        onApprove={async (comments) => { await actionMutation.mutateAsync({ action: 'approve', comments }); }}
                        onReject={async (comments) => { await actionMutation.mutateAsync({ action: 'reject', comments }); }}
                        isLoading={actionMutation.isPending}
                        canAction={isApprover === true}
                        isWatcher={isWatcher}
                    />

                    {isWatcher && (
                        <div className="rounded-xl bg-indigo-50/50 p-4 border border-indigo-100 text-sm text-indigo-700 font-medium flex gap-3">
                            <Eye size={18} className="shrink-0" />
                            <p>You are viewing this request as a <strong>Watcher</strong>. You have read-only access and cannot perform approval actions.</p>
                        </div>
                    )}

                    {!isApprover && detail.status === 'IN_PROGRESS' && !isWatcher && (
                        <div className="rounded-xl bg-blue-50/50 p-4 border border-blue-100 text-sm text-blue-700 font-medium flex gap-3">
                            <Clock size={18} className="shrink-0" />
                            <p>This request is currently with another approver. You can take action when it reaches your step.</p>
                        </div>
                    )}
                </div>
            </div>

            {activeStep && (
                <DelegateModal
                    isOpen={isDelegateModalOpen}
                    onClose={() => setIsDelegateModalOpen(false)}
                    onSubmit={async (new_assignee_id, comments) => {
                        await delegateMutation.mutateAsync({ new_assignee_id, comments });
                    }}
                    roleRequiredId={activeStep.role_required}
                    roleName={activeStep.role_name}
                    isLoading={delegateMutation.isPending}
                />
            )}

            <AddWatcherModal
                isOpen={isAddWatcherModalOpen}
                onClose={() => setIsAddWatcherModalOpen(false)}
                onSubmit={async (userId) => {
                    await addWatcherMutation.mutateAsync(userId);
                }}
                isLoading={addWatcherMutation.isPending}
            />

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => {
                    setIsConfirmModalOpen(false);
                    setWatcherToRemove(null);
                }}
                onConfirm={() => watcherToRemove && removeWatcherMutation.mutate(watcherToRemove.id)}
                title="Remove Watcher?"
                description={`Are you sure you want to remove ${watcherToRemove?.name} from this request? They will no longer receive updates.`}
                confirmText="Yes, Remove"
                isLoading={removeWatcherMutation.isPending}
                variant="danger"
            />
        </div>
    );
};
