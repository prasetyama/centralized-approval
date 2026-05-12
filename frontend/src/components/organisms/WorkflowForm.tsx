import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, X } from 'lucide-react';
import api from '@/services/api';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { Textarea } from '@/components/atoms/Textarea';
import { CriteriaRuleBuilder } from '@/components/molecules/CriteriaRuleBuilder';

interface Step {
    id?: number;
    name: string;
    step_order: number;
    approver_type: 'ROLE' | 'USER';
    role_required?: number | null;
    user_required?: number | null;
    is_brand_conditional: boolean;
    master_workflow_criteria?: number | null;
    is_optional: boolean;
    conditions: any[];
    role_name?: string;
    user_name?: string;
}

interface WorkflowFormProps {
    initialData?: any;
    onClose: () => void;
}

export const WorkflowForm: React.FC<WorkflowFormProps> = ({ initialData, onClose }) => {
    const queryClient = useQueryClient();
    const isEdit = !!initialData;

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        module: initialData?.module || '',
        is_active: initialData?.is_active ?? true,
        steps: initialData?.steps || [] as Step[],
    });

    const { data: modules } = useQuery<any>({
        queryKey: ['admin-modules'],
        queryFn: () => api.get('/admin/modules'),
    });

    const { data: MasterWorkflowCondition } = useQuery<any>({
        queryKey: ['admin-master-workflow-conditions'],
        queryFn: () => api.get('/admin/master-workflow-conditions'),
    });

    const { data: roles } = useQuery<any>({
        queryKey: ['admin-roles'],
        queryFn: () => api.get('/admin/roles'),
    });

    const { data: users } = useQuery<any>({
        queryKey: ['admin-users'],
        queryFn: () => api.get('/admin/users?is_approver=true'),
    });

    const mutation = useMutation({
        mutationFn: (data: any) => {
            if (isEdit) {
                return api.put(`/admin/workflows/${initialData.id}/`, data);
            }
            return api.post('/admin/workflows/', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-workflows'] });
            onClose();
        },
    });

    const handleAddStep = () => {
        const newStep: Step = {
            name: '',
            step_order: formData.steps.length + 1,
            approver_type: 'ROLE',
            role_required: (roles as any)?.results?.[0]?.id || null,
            user_required: null,
            is_brand_conditional: false,
            master_workflow_criteria: null,
            is_optional: false,
            conditions: [],
        };
        setFormData({ ...formData, steps: [...formData.steps, newStep] });
    };

    const handleRemoveStep = (index: number) => {
        const newSteps = formData.steps.filter((_: Step, i: number) => i !== index);
        // Reorder steps
        const reorderedSteps = newSteps.map((step: Step, i: number) => ({ ...step, step_order: i + 1 }));
        setFormData({ ...formData, steps: reorderedSteps });
    };

    const handleStepChange = (index: number, updates: Partial<Step>) => {
        setFormData(prev => {
            const newSteps = [...prev.steps];
            newSteps[index] = { ...newSteps[index], ...updates };
            return { ...prev, steps: newSteps };
        });
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        const newSteps = [...formData.steps];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newSteps.length) return;

        const temp = newSteps[index];
        newSteps[index] = newSteps[targetIndex];
        newSteps[targetIndex] = temp;

        // Update step_order
        const updatedSteps = newSteps.map((step: Step, i: number) => ({ ...step, step_order: i + 1 }));
        setFormData({ ...formData, steps: updatedSteps });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({
            ...formData,
            module: parseInt(formData.module as string),
            total_steps: formData.steps.length,
        });
    };

    const moduleOptions = ((modules as any)?.results || []).map((m: any) => ({ value: m.id, label: m.name }));
    const roleOptions = ((roles as any)?.results || []).map((r: any) => ({ value: r.id, label: r.name }));
    const userOptions = ((users as any)?.results || []).map((u: any) => ({
        value: u.id,
        label: `${u.first_name} ${u.last_name}`.trim() || u.username
    }));

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Workflow' : 'Create New Workflow'}</h2>
                    <p className="text-slate-500 text-sm">Define the approval sequence and rules.</p>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={onClose} className="gap-2">
                        <X size={16} /> Cancel
                    </Button>
                    <Button type="submit" disabled={mutation.isPending} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Save size={16} /> {mutation.isPending ? 'Saving...' : 'Save Workflow'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="p-6 space-y-4 lg:col-span-1 border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Basic Information</h3>
                    <Input
                        label="Workflow Name"
                        placeholder="e.g. Purchase Approval"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                    <Textarea
                        label="Description"
                        placeholder="Describe what this workflow is for..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="h-32"
                    />
                    <Select
                        label="Target Module"
                        options={[{ value: '', label: 'Select Module' }, ...moduleOptions]}
                        value={formData.module}
                        onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                        required
                    />
                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="text-sm font-bold text-slate-700 select-none">
                            Active Definition
                        </label>
                    </div>
                </Card>

                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Workflow Steps</h3>
                        <Button type="button" size="sm" onClick={handleAddStep} className="gap-2 bg-slate-900">
                            <Plus size={14} /> Add Step
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {formData.steps.map((step: Step, index: number) => (
                            <div key={index} className="flex gap-4 items-start animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                                <div className="flex flex-col gap-1 pt-8">
                                    <button
                                        type="button"
                                        onClick={() => moveStep(index, 'up')}
                                        disabled={index === 0}
                                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 text-slate-400"
                                    >
                                        <ArrowUp size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveStep(index, 'down')}
                                        disabled={index === formData.steps.length - 1}
                                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 text-slate-400"
                                    >
                                        <ArrowDown size={16} />
                                    </button>
                                </div>

                                <Card className="flex-1 p-4 border-slate-100 shadow-sm relative group">
                                    <div className="absolute -left-3 top-4 w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-sm">
                                        {index + 1}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="md:col-span-1">
                                            <Input
                                                label="Step Name"
                                                placeholder="e.g. Supervisor Review"
                                                value={step.name}
                                                onChange={(e) => handleStepChange(index, { name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <Select
                                                label="Approver Type"
                                                options={[
                                                    { value: 'ROLE', label: 'Role-based' },
                                                    { value: 'USER', label: 'Specific User' }
                                                ]}
                                                value={step.approver_type}
                                                onChange={(e) => {
                                                    const type = e.target.value as 'ROLE' | 'USER';
                                                    const updates: Partial<Step> = { approver_type: type };
                                                    if (type === 'ROLE') {
                                                        updates.role_required = (roles as any)?.results?.[0]?.id || null;
                                                        updates.user_required = null;
                                                    } else {
                                                        updates.user_required = (users as any)?.results?.[0]?.id || null;
                                                        updates.role_required = null;
                                                    }
                                                    handleStepChange(index, updates);
                                                }}
                                                required
                                            />
                                        </div>
                                        <div className="md:col-span-1 flex gap-4 items-end">
                                            {step.approver_type === 'ROLE' ? (
                                                <Select
                                                    label="Role Required"
                                                    options={roleOptions}
                                                    value={step.role_required || ''}
                                                    onChange={(e) => handleStepChange(index, { role_required: parseInt(e.target.value) })}
                                                    required
                                                />
                                            ) : (
                                                <Select
                                                    label="User Required"
                                                    options={userOptions}
                                                    value={step.user_required || ''}
                                                    onChange={(e) => handleStepChange(index, { user_required: parseInt(e.target.value) })}
                                                    required
                                                />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveStep(index)}
                                                className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg mb-0.5 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-6 mt-4 pt-3 border-t border-slate-50">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`brand-cond-${index}`}
                                                checked={step.is_brand_conditional}
                                                onChange={(e) => handleStepChange(index, { is_brand_conditional: e.target.checked })}
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <label htmlFor={`brand-cond-${index}`} className="text-xs font-bold text-slate-700 select-none">
                                                Gunakan Kondisi?
                                            </label>
                                        </div>
                                        {step.is_brand_conditional && (
                                            <div className='w-[30%]'>
                                                <Select
                                                    value={step.master_workflow_criteria?.toString() || ''}
                                                    onChange={(e) => handleStepChange(index, { master_workflow_criteria: e.target.value ? parseInt(e.target.value) : null })}
                                                    options={((MasterWorkflowCondition as any)?.results || []).map((c: any) => ({ value: c.id, label: c.name }))}
                                                    required
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-6 mt-4 pt-3 border-t border-slate-50">
                                        <div className='flex items-center gap-2'>
                                            <input
                                                type="checkbox"
                                                id={`optional-${index}`}
                                                checked={step.is_optional}
                                                onChange={(e) => handleStepChange(index, { is_optional: e.target.checked })}
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <label htmlFor={`optional-${index}`} className="text-xs font-bold text-slate-700 select-none">
                                                Optional Step
                                            </label>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-50">
                                        <CriteriaRuleBuilder 
                                            moduleId={formData.module}
                                            conditions={step.conditions || []}
                                            onChange={(conditions) => handleStepChange(index, { conditions })}
                                        />
                                    </div>
                                </Card>
                            </div>
                        ))}

                        {formData.steps.length === 0 && (
                            <div className="border-2 border-dashed border-slate-100 rounded-2xl p-12 text-center bg-slate-50/50">
                                <Plus className="mx-auto text-slate-300 mb-2" size={32} />
                                <p className="text-sm font-bold text-slate-400">No steps defined yet</p>
                                <p className="text-xs text-slate-500 mt-1">Add at least one step to complete the workflow sequence.</p>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddStep} className="mt-4 gap-2 bg-white">
                                    <Plus size={14} /> Add First Step
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
};
