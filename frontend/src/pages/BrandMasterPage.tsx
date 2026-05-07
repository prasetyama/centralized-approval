import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Save, Tag, Users, ShieldCheck } from 'lucide-react';
import api from '@/services/api';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';

export const BrandMasterPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'brands' | 'user-brands'>('brands');
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

    const { data: userBrands } = useQuery<any>({
        queryKey: ['user-brands'],
        queryFn: () => api.get('/admin/user-brands'),
    });

    // -- State for editing --
    const [editingBrand, setEditingBrand] = useState<any>(null);
    const [editingUserBrand, setEditingUserBrand] = useState<any>(null);

    // -- Mutations --
    const brandMutation = useMutation({
        mutationFn: (data: any) => data.id ? api.put(`/admin/brands/${data.id}/`, data) : api.post('/admin/brands/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['brands'] });
            setEditingBrand(null);
        }
    });

    const userBrandMutation = useMutation({
        mutationFn: (data: any) => data.id ? api.put(`/admin/user-brands/${data.id}/`, data) : api.post('/admin/user-brands/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-brands'] });
            setEditingUserBrand(null);
        }
    });

    const deleteBrand = (id: number) => {
        if (confirm('Delete this brand? All related settings will be lost.')) {
            api.delete(`/admin/brands/${id}/`).then(() => {
                queryClient.invalidateQueries({ queryKey: ['brands'] });
            });
        }
    };

    const userOptions = ((users as any)?.results || []).map((u: any) => ({
        value: u.id,
        label: `${u.first_name} ${u.last_name}`.trim() || u.username
    }));

    const brandOptions = ((brands as any)?.results || []).map((b: any) => ({
        value: b.id,
        label: b.name
    }));

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Brand Management</h1>
                    <p className="text-slate-500 font-medium">Manage brands and their designated approval owners.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                    <button
                        onClick={() => setActiveTab('brands')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'brands' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Tag size={16} /> Brands & Owners
                    </button>
                    {/* <button
                        onClick={() => setActiveTab('user-brands')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'user-brands' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users size={16} /> User Assignment
                    </button> */}
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
                                    value={editingBrand?.name || ''}
                                    onChange={e => setEditingBrand({ ...editingBrand, name: e.target.value })}
                                    placeholder="e.g. Apple"
                                />
                                <Input
                                    label="Brand Code"
                                    value={editingBrand?.code || ''}
                                    onChange={e => setEditingBrand({ ...editingBrand, code: e.target.value })}
                                    placeholder="e.g. APPLE"
                                />
                                <Select
                                    label="Designated Owner (Approver)"
                                    options={[{ value: '', label: 'No Owner Assigned' }, ...userOptions]}
                                    value={editingBrand?.owner || ''}
                                    onChange={e => setEditingBrand({ ...editingBrand, owner: e.target.value ? parseInt(e.target.value) : null })}
                                />
                                <div className="flex gap-2 pt-2">
                                    {editingBrand && (
                                        <Button variant="outline" fullWidth onClick={() => setEditingBrand(null)}>Cancel</Button>
                                    )}
                                    <Button
                                        fullWidth
                                        className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => brandMutation.mutate(editingBrand)}
                                    >
                                        <Save size={16} className="mr-2" /> {editingBrand?.id ? 'Update Brand' : 'Save Brand'}
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
                                                    <span className="flex items-center gap-2 text-slate-900 font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full w-fit text-sm">
                                                        <ShieldCheck size={14} /> {b.owner_full_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-sm">No primary owner</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setEditingBrand(b)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Brand"><Edit size={18} /></button>
                                                    <button onClick={() => deleteBrand(b.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete Brand"><Trash2 size={18} /></button>
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

            {activeTab === 'user-brands' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <Card className="p-6 border-slate-100 shadow-xl">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Users size={18} /> Assign User to Brand
                            </h3>
                            <p className="text-sm text-slate-500 mb-6 italic">Secondary assignments for visibility or backup owners.</p>
                            <div className="space-y-4">
                                <Select
                                    label="User"
                                    options={[{ value: '', label: 'Select User' }, ...userOptions]}
                                    value={editingUserBrand?.user || ''}
                                    onChange={e => setEditingUserBrand({ ...editingUserBrand, user: parseInt(e.target.value) })}
                                />
                                <Select
                                    label="Brand"
                                    options={[{ value: '', label: 'Select Brand' }, ...brandOptions]}
                                    value={editingUserBrand?.brand || ''}
                                    onChange={e => setEditingUserBrand({ ...editingUserBrand, brand: parseInt(e.target.value) })}
                                />
                                <Button
                                    fullWidth
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={() => userBrandMutation.mutate(editingUserBrand)}
                                >
                                    <Plus size={16} className="mr-2" /> Assign User
                                </Button>
                            </div>
                        </Card>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(userBrands as any)?.results?.map((ub: any) => (
                                <Card key={ub.id} className="p-5 border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="h-11 w-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-300">
                                            {ub.user_name?.[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900">{ub.user_full_name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                    {ub.brand_name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (confirm('Remove assignment?')) {
                                                api.delete(`/admin/user-brands/${ub.id}/`).then(() => {
                                                    queryClient.invalidateQueries({ queryKey: ['user-brands'] });
                                                });
                                            }
                                        }}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
