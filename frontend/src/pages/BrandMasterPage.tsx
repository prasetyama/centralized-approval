import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Save, Tag, Users, Key } from 'lucide-react';
import api from '@/services/api';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { ConfirmationModal } from '@/components/molecules/ConfirmationModal';

export const BrandMasterPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'brands' | 'master-workflow-conditions' | 'module-variables'>('master-workflow-conditions');
    const queryClient = useQueryClient();

    // -- Queries --
    const { data: brands } = useQuery<any>({
        queryKey: ['brands'],
        queryFn: () => api.get('/admin/brands'),
    });

    const { data: users } = useQuery<any>({
        queryKey: ['admin-users'],
        queryFn: () => api.get('/admin/users?is_approver=true'),
    });

    const { data: moduleVariables } = useQuery<any>({
        queryKey: ['admin-module-variables'],
        queryFn: () => api.get('/admin/module-variables'),
    });

    const { data: modules } = useQuery<any>({
        queryKey: ['admin-modules'],
        queryFn: () => api.get('/admin/modules'),
    });

    const dataType = [
        { value: 'NUMBER', label: 'Number' },
        { value: 'STRING', label: 'String' },
        { value: 'BOOLEAN', label: 'Boolean' },
    ];

    const { data: masterWorkflowConditions } = useQuery<any>({
        queryKey: ['admin-master-workflow-conditions'],
        queryFn: () => api.get('/admin/master-workflow-conditions'),
    });

    // -- State for editing --
    const [editingBrand, setEditingBrand] = useState<any>(null);
    const [editingMasterWorkflowCondition, setEditingMasterWorkflowCondition] = useState<any>(null);
    const [editingModuleVariable, setEditingModuleVariable] = useState<any>(null);
    const [showErrors, setShowErrors] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; type: 'brand' | 'condition' | 'module_variable' } | null>(null);

    // -- Mutations --
    const brandMutation = useMutation({
        mutationFn: (data: any) => data.id ? api.put(`/admin/brands/${data.id}/`, data) : api.post('/admin/brands/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['brands'] });
            setEditingBrand(null);
            setShowErrors(false);
        }
    });

    const masterWorkflowConditionMutation = useMutation({
        mutationFn: (data: any) => data.id ? api.put(`/admin/master-workflow-conditions/${data.id}/`, data) : api.post('/admin/master-workflow-conditions/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-master-workflow-conditions'] });
            setEditingMasterWorkflowCondition(null);
            setShowErrors(false);
        }
    });

    const moduleVariableMutation = useMutation({
        mutationFn: (data: any) => data.id ? api.put(`/admin/module-variables/${data.id}/`, data) : api.post('/admin/module-variables/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-module-variables'] });
            setEditingModuleVariable(null);
            setShowErrors(false);
        }
    });

    const handleConfirmDelete = () => {
        if (!deleteTarget) return;

        let url = ''

        if (deleteTarget.type === 'brand') {
            url = `/admin/brands/${deleteTarget.id}/`;
        } else if (deleteTarget.type === 'condition') {
            url = `/admin/master-workflow-conditions/${deleteTarget.id}/`;
        } else if (deleteTarget.type === 'module_variable') {
            url = `/admin/module-variables/${deleteTarget.id}/`;
        }

        // const url = deleteTarget.type === 'brand'
        //     ? `/admin/brands/${deleteTarget.id}/`
        //     : `/admin/master-workflow-conditions/${deleteTarget.id}/`;

        const queryKey = deleteTarget.type === 'brand' ? ['brands'] : ['admin-master-workflow-conditions'];

        api.delete(url).then(() => {
            queryClient.invalidateQueries({ queryKey });
            setIsConfirmModalOpen(false);
            setDeleteTarget(null);
        });
    };

    const deleteBrand = (id: number, name: string) => {
        setDeleteTarget({ id, name, type: 'brand' });
        setIsConfirmModalOpen(true);
    };

    const deleteMasterWorkflowCondition = (id: number, name: string) => {
        setDeleteTarget({ id, name, type: 'condition' });
        setIsConfirmModalOpen(true);
    };

    const deleteModuleVariable = (id: number, name: string) => {
        console.log(id, name);
        setDeleteTarget({ id, name, type: 'module_variable' });
        setIsConfirmModalOpen(true);
    };

    const userOptions = ((users as any)?.results || []).map((u: any) => ({
        value: u.id,
        label: `${u.first_name} ${u.last_name}`.trim() || u.username
    }));

    const moduleOptions = ((modules as any)?.results || []).map((m: any) => ({
        value: m.id,
        label: m.name
    }));

    const workflowConditionOptions = ((masterWorkflowConditions as any)?.results || []).map((w: any) => ({
        value: w.id,
        label: w.name
    }));

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Master Management</h1>
                    <p className="text-slate-500 font-medium">Manage Brands & Owners, Conditions and Variables Modules.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                    <button
                        onClick={() => setActiveTab('master-workflow-conditions')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'master-workflow-conditions' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users size={16} /> Master Workflow Conditions
                    </button>
                    <button
                        onClick={() => setActiveTab('brands')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'brands' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Tag size={16} /> Brands & Owners
                    </button>
                    <button
                        onClick={() => setActiveTab('module-variables')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'module-variables' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Key size={16} /> Module Variables
                    </button>
                </div>
            </header>

            {activeTab === 'brands' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <Card className="p-6 border-slate-100 shadow-xl shadow-slate-200/50">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                {editingBrand ? <Edit size={18} /> : <Plus size={18} />}
                                {editingBrand ? 'Edit Brand' : 'Register Brand'}
                            </h3>
                            <div className="space-y-5">
                                <Input
                                    label="Brand Name"
                                    required
                                    value={editingBrand?.name || ''}
                                    onChange={e => setEditingBrand({ ...editingBrand, name: e.target.value })}
                                    placeholder="Samsung"
                                    error={(showErrors || brandMutation.isError) && !editingBrand?.name ? "Field is required" : ""}
                                />
                                <Input
                                    label="Brand Code"
                                    required
                                    value={editingBrand?.code || ''}
                                    onChange={e => setEditingBrand({ ...editingBrand, code: e.target.value })}
                                    placeholder="SSG"
                                    error={(showErrors || brandMutation.isError) && !editingBrand?.code ? "Field is required" : ""}
                                />
                                <Select
                                    label="Designated Owner (Approver)"
                                    required
                                    options={[{ value: '', label: 'No Owner Assigned' }, ...userOptions]}
                                    value={editingBrand?.owner || ''}
                                    onChange={e => setEditingBrand({ ...editingBrand, owner: e.target.value ? parseInt(e.target.value) : null })}
                                    error={(showErrors || brandMutation.isError) && !editingBrand?.owner ? "Field is required" : ""}
                                />
                                <Select
                                    label="Master Workflow Condition"
                                    required
                                    options={[{ value: '', label: 'No Master Workflow Condition Assigned' }, ...workflowConditionOptions]}
                                    value={editingBrand?.master_workflow_condition || ''}
                                    onChange={e => setEditingBrand({ ...editingBrand, master_workflow_condition: e.target.value ? parseInt(e.target.value) : null })}
                                    error={(showErrors || brandMutation.isError) && !editingBrand?.master_workflow_condition ? "Field is required" : ""}
                                />
                                <div className="flex gap-2 pt-2">
                                    {editingBrand && (
                                        <Button variant="outline" fullWidth onClick={() => {
                                            setEditingBrand(null);
                                            setShowErrors(false);
                                        }}>Cancel</Button>
                                    )}
                                    <Button
                                        fullWidth
                                        className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => {
                                            if (!editingBrand?.name || !editingBrand?.code || !editingBrand?.owner || !editingBrand?.master_workflow_condition) {
                                                setShowErrors(true);
                                                return;
                                            }
                                            brandMutation.mutate(editingBrand);
                                        }}
                                    >
                                        <Save size={16} className="mr-2" /> {editingBrand?.id ? 'Update' : 'Create'}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                    <div className="lg:col-span-2">
                        <Card className="overflow-hidden border-slate-100 shadow-lg shadow-slate-200/40">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Brand</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Code</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Primary Owner</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Master Workflow Conditions</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(brands as any)?.results?.map((b: any) => (
                                        <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900">{b.name}</td>
                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono font-bold tracking-tight">{b.code}</span></td>
                                            <td className="px-6 py-4">
                                                {b.owner_full_name ? (
                                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono font-bold tracking-tight">{b.owner_full_name}</span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono font-bold tracking-tight">No primary owner</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono font-bold tracking-tight">{b.master_workflow_condition_name}</span></td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setEditingBrand(b)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Brand"><Edit size={18} /></button>
                                                    <button onClick={() => deleteBrand(b.id, b.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete Brand"><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'master-workflow-conditions' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <Card className="p-6 border-slate-100 shadow-xl">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                {editingMasterWorkflowCondition ? <Edit size={18} /> : <Plus size={18} />}
                                {editingMasterWorkflowCondition ? 'Edit Master Workflow Condition' : 'Register Master Workflow Condition'}
                            </h3>
                            <div className="space-y-4">
                                <Input
                                    label="Name"
                                    required
                                    value={editingMasterWorkflowCondition?.name || ''}
                                    onChange={e => setEditingMasterWorkflowCondition({ ...editingMasterWorkflowCondition, name: e.target.value })}
                                    placeholder="Master Zone"
                                    error={(showErrors || masterWorkflowConditionMutation.isError) && !editingMasterWorkflowCondition?.name ? "Field is required" : ""}
                                />
                                <Input
                                    label="Key Parameter JSON"
                                    required
                                    value={editingMasterWorkflowCondition?.key_param_json || ''}
                                    onChange={e => setEditingMasterWorkflowCondition({ ...editingMasterWorkflowCondition, key_param_json: e.target.value })}
                                    placeholder='zone_code'
                                    error={(showErrors || masterWorkflowConditionMutation.isError) && !editingMasterWorkflowCondition?.key_param_json ? "Field is required" : ""}
                                />
                                <div className='flex gap-2 pt-2'>
                                    {editingMasterWorkflowCondition && (
                                        <Button variant="outline" fullWidth onClick={() => {
                                            setEditingMasterWorkflowCondition(null);
                                            setShowErrors(false);
                                        }}>Cancel</Button>
                                    )}
                                    <Button
                                        fullWidth
                                        className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => {
                                            if (!editingMasterWorkflowCondition?.name || !editingMasterWorkflowCondition?.key_param_json) {
                                                setShowErrors(true);
                                                return;
                                            }
                                            masterWorkflowConditionMutation.mutate(editingMasterWorkflowCondition);
                                        }}
                                    >
                                        <Save size={16} className="mr-2" /> {editingMasterWorkflowCondition?.id ? 'Update' : 'Create'}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                    <div className="lg:col-span-2">
                        <Card className="overflow-hidden border-slate-100 shadow-lg shadow-slate-200/40">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Brand</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Key Param JSON</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(masterWorkflowConditions as any)?.results?.map((c: any) => (
                                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono font-bold tracking-tight">{c.key_param_json}</span></td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setEditingMasterWorkflowCondition(c)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Condition"><Edit size={18} /></button>
                                                    <button onClick={() => deleteMasterWorkflowCondition(c.id, c.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete Condition"><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'module-variables' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <Card className="p-6 border-slate-100 shadow-xl shadow-slate-200/50">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                {editingModuleVariable ? <Edit size={18} /> : <Plus size={18} />}
                                {editingModuleVariable ? 'Edit Module Variable' : 'Register Module Variable'}
                            </h3>
                            <div className="space-y-5">
                                <Input
                                    label="Name"
                                    required
                                    value={editingModuleVariable?.name || ''}
                                    onChange={e => setEditingModuleVariable({ ...editingModuleVariable, name: e.target.value })}
                                    placeholder="Total Amount"
                                    error={(showErrors || moduleVariableMutation.isError) && !editingModuleVariable?.name ? "Field is required" : ""}
                                />
                                <Input
                                    label="Key Name"
                                    required
                                    value={editingModuleVariable?.key_name || ''}
                                    onChange={e => setEditingModuleVariable({ ...editingModuleVariable, key_name: e.target.value })}
                                    placeholder="total_amount"
                                    error={(showErrors || moduleVariableMutation.isError) && !editingModuleVariable?.key_name ? "Field is required" : ""}
                                />
                                <Select
                                    label="Module"
                                    required
                                    options={[{ value: '', label: 'Select Module' }, ...moduleOptions]}
                                    value={editingModuleVariable?.module || ''}
                                    onChange={e => setEditingModuleVariable({ ...editingModuleVariable, module: parseInt(e.target.value) })}
                                    error={(showErrors || moduleVariableMutation.isError) && !editingModuleVariable?.module ? "Field is required" : ""}
                                />
                                <Select
                                    label="Data Type"
                                    required
                                    value={editingModuleVariable?.data_type || ''}
                                    onChange={e => setEditingModuleVariable({ ...editingModuleVariable, data_type: e.target.value })}
                                    options={[{ value: '', label: 'Select Data Type' }, ...dataType]}
                                    error={(showErrors || moduleVariableMutation.isError) && !editingModuleVariable?.data_type ? "Field is required" : ""}
                                />

                                <div className='flex gap-2 pt-2'>
                                    {editingModuleVariable && (
                                        <Button variant="outline" fullWidth onClick={() => {
                                            setEditingModuleVariable(null);
                                            setShowErrors(false);
                                        }}>Cancel</Button>
                                    )}
                                    <Button
                                        fullWidth
                                        className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => {
                                            if (!editingModuleVariable?.name || !editingModuleVariable?.key_name || !editingModuleVariable?.data_type || !editingModuleVariable?.module) {
                                                setShowErrors(true);
                                                return;
                                            }
                                            moduleVariableMutation.mutate(editingModuleVariable);
                                        }}
                                    >
                                        <Save size={16} className="mr-2" /> {editingModuleVariable?.id ? 'Update' : 'Create'}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="lg:col-span-2">
                        <Card className="border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/30">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                        <Key size={20} className="text-blue-600" />
                                        Modules Variables
                                    </h3>
                                </div>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50/70">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-left">Variable Name</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-left">Module</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-left">Key Name</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-left">Data Type</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(moduleVariables as any)?.results?.map((c: any) => (
                                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono font-bold tracking-tight">{c.module_name}</span></td>
                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono font-bold tracking-tight">{c.key_name}</span></td>
                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono font-bold tracking-tight">{c.data_type}</span></td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setEditingModuleVariable(c)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Condition"><Edit size={18} /></button>
                                                    <button onClick={() => deleteModuleVariable(c.id, c.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete Condition"><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => {
                    setIsConfirmModalOpen(false);
                    setDeleteTarget(null);
                }}
                onConfirm={handleConfirmDelete}
                title={`Delete ${deleteTarget?.name}?`}
                description={`Are you sure you want to delete ${deleteTarget?.name}?`}
                confirmText="Yes, Delete"
                variant="danger"
            />
        </div>
    );
};
