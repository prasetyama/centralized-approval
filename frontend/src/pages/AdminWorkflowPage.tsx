import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, Plus, Trash2, Edit2, ChevronRight, ArrowLeft } from 'lucide-react';
import api from '@/services/api';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { WorkflowForm } from '@/components/organisms/WorkflowForm';

export const AdminWorkflowPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [editingWorkflow, setEditingWorkflow] = useState<any>(null);
    const isAdding = window.location.pathname.endsWith('/new');

    const { data: workflows, isLoading } = useQuery({
        queryKey: ['admin-workflows'],
        queryFn: () => api.get('/admin/workflows') as Promise<any>,
    });

    useEffect(() => {
        if (id && workflows?.results) {
            const wf = workflows.results.find((w: any) => w.id === parseInt(id));
            if (wf) setEditingWorkflow(wf);
        } else {
            setEditingWorkflow(null);
        }
    }, [id, workflows]);

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">Loading workflow definitions...</div>;
    }

    if (isAdding || editingWorkflow) {
        return (
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/admin/workflows')}
                    className="gap-2 text-slate-500 hover:text-slate-900"
                >
                    <ArrowLeft size={16} /> Back to List
                </Button>
                <WorkflowForm
                    initialData={editingWorkflow}
                    onClose={() => navigate('/admin/workflows')}
                />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Workflow Definitions</h1>
                    <p className="mt-1 text-slate-500">Configure approval steps and rules for each registered module.</p>
                </div>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => navigate('/admin/workflows/new')}>
                    <Plus size={16} /> New Workflow
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {(workflows?.results || []).map((wf: any) => (
                    <Card key={wf.id} className="group hover:shadow-xl transition-all duration-300 border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-6 flex-1 space-y-6">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] font-bold tracking-widest uppercase py-0.5">
                                            {wf.module_name}
                                        </Badge>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                                        {wf.name}
                                    </h3>
                                </div>
                                <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-all">
                                    <GitBranch className="text-slate-400 group-hover:text-blue-500 transition-colors" size={24} />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approval Sequence</p>
                                <div className="flex items-center flex-wrap gap-2">
                                    {(wf.steps || []).map((step: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex flex-col items-center min-w-[100px] shadow-sm group-hover:border-blue-200 transition-all">
                                                <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Step {idx + 1}</span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {step.approver_type === 'USER' ? step.user_name : step.role_name}
                                                </span>
                                            </div>
                                            {idx < wf.steps.length - 1 && <ChevronRight size={14} className="text-slate-300" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Steps</span>
                                        <span className="text-sm font-black text-slate-700">{wf.total_steps}</span>
                                    </div>
                                </div>
                                <Badge variant={wf.is_active ? 'success' : 'secondary'}>
                                    {wf.is_active ? 'ACTIVE' : 'INACTIVE'}
                                </Badge>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-2 bg-white"
                                onClick={() => navigate(`/admin/workflows/${wf.id}/edit`)}
                            >
                                <Edit2 size={14} /> Configure
                            </Button>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-red-600">
                                <Trash2 size={18} />
                            </Button>
                        </div>
                    </Card>
                ))}

                <button
                    onClick={() => navigate('/admin/workflows/new')}
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/50 transition-all group min-h-[300px]"
                >
                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-all">
                        <Plus className="text-slate-400 group-hover:text-blue-500" size={32} />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-slate-900">Define New Workflow</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Create an approval sequence for a registered module.</p>
                    </div>
                </button>
            </div>
        </div>
    );
};
