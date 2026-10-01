import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Building2, Users, Plus, Edit2, Trash2, Search,
    Network, X, CornerDownRight
} from 'lucide-react';
import api from '@/services/api';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';

export const AdminOrgStructurePage = () => {
    const queryClient = useQueryClient();
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [editingOrgNode, setEditingOrgNode] = useState<any>(null);
    const [editingCompany, setEditingCompany] = useState<any>(null);

    // Node Form State
    const [orgFormData, setOrgFormData] = useState({
        company: '',
        user: '',
        department: '',
        position_title: '',
        level_order: 1,
        reports_to: '',
        is_dept_head: false,
    });

    // Company Form State
    const [companyFormData, setCompanyFormData] = useState({
        name: '',
        code: '',
        description: '',
        is_active: true,
    });

    // Fetch Master Data
    const { data: companiesData } = useQuery<any>({
        queryKey: ['admin-companies'],
        queryFn: () => api.get('/admin/companies'),
    });

    const { data: departmentsData } = useQuery<any>({
        queryKey: ['admin-departments'],
        queryFn: () => api.get('/admin/departments'),
    });

    const { data: usersData } = useQuery<any>({
        queryKey: ['admin-users'],
        queryFn: () => api.get('/admin/users', { params: { is_active: true, page_size: 1000 } }),
    });

    const { data: orgStructuresData, isLoading } = useQuery<any>({
        queryKey: ['admin-org-structures', selectedCompanyId, selectedDepartmentId],
        queryFn: () => {
            const params: any = {};
            if (selectedCompanyId) params.company = selectedCompanyId;
            if (selectedDepartmentId) params.department = selectedDepartmentId;
            return api.get('/admin/org-structures', { params });
        },
    });

    const companies = companiesData?.results || [];
    const departments = departmentsData?.results || [];
    const users = usersData?.results || [];
    const orgNodes = orgStructuresData?.results || [];

    // Mutations for Org Nodes
    const saveOrgNodeMutation = useMutation({
        mutationFn: (data: any) => {
            if (editingOrgNode?.id) {
                return api.put(`/admin/org-structures/${editingOrgNode.id}/`, data);
            }
            return api.post('/admin/org-structures/', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-org-structures'] });
            setIsOrgModalOpen(false);
            setEditingOrgNode(null);
        },
        onError: (err: any) => alert(err?.message || 'Failed to save node'),
    });

    const deleteOrgNodeMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/admin/org-structures/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-org-structures'] });
        },
    });

    // Mutations for Companies
    const saveCompanyMutation = useMutation({
        mutationFn: (data: any) => {
            if (editingCompany?.id) {
                return api.put(`/admin/companies/${editingCompany.id}/`, data);
            }
            return api.post('/admin/companies/', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
            setIsCompanyModalOpen(false);
            setEditingCompany(null);
        },
        onError: (err: any) => alert(err?.message || 'Failed to save company'),
    });

    const openAddOrgNode = () => {
        setEditingOrgNode(null);
        setOrgFormData({
            company: selectedCompanyId || (companies[0]?.id?.toString() || ''),
            user: '',
            department: selectedDepartmentId || (departments[0]?.id?.toString() || ''),
            position_title: '',
            level_order: 1,
            reports_to: '',
            is_dept_head: false,
        });
        setIsOrgModalOpen(true);
    };

    const openEditOrgNode = (node: any) => {
        setEditingOrgNode(node);
        setOrgFormData({
            company: node.company?.toString() || node.company_id?.toString() || '',
            user: node.user?.toString() || '',
            department: node.department?.toString() || '',
            position_title: node.position_title || '',
            level_order: node.level_order || 1,
            reports_to: node.reports_to?.toString() || '',
            is_dept_head: node.is_dept_head || false,
        });
        setIsOrgModalOpen(true);
    };

    const openCompanyModal = (comp?: any) => {
        if (comp) {
            setEditingCompany(comp);
            setCompanyFormData({
                name: comp.name,
                code: comp.code,
                description: comp.description || '',
                is_active: comp.is_active ?? true,
            });
        } else {
            setEditingCompany(null);
            setCompanyFormData({
                name: '',
                code: '',
                description: '',
                is_active: true,
            });
        }
        setIsCompanyModalOpen(true);
    };

    const filteredNodes = orgNodes.filter((node: any) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            node.user_full_name?.toLowerCase().includes(term) ||
            node.user_name?.toLowerCase().includes(term) ||
            node.position_title?.toLowerCase().includes(term) ||
            node.company_name?.toLowerCase().includes(term) ||
            node.department_name?.toLowerCase().includes(term)
        );
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <Network className="text-indigo-600" size={32} />
                        Master Organization Structure
                    </h1>
                    <p className="mt-1 text-slate-500 text-sm">
                        Kelola struktur hirarki pegawai (Staff → Manager → Dept Head) per perusahaan untuk alur approval otomatis.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => openCompanyModal()}
                        className="gap-2 border-slate-200 hover:bg-slate-50"
                    >
                        <Building2 size={16} className="text-slate-600" />
                        Kelola Perusahaan ({companies.length})
                    </Button>
                    <Button
                        onClick={openAddOrgNode}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100"
                    >
                        <Plus size={16} />
                        Tambah Struktur
                    </Button>
                </div>
            </div>

            {/* Filter Bar */}
            <Card className="p-4 border-slate-100 shadow-sm bg-white">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div className="relative col-span-1 md:col-span-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            placeholder="Cari nama pegawai, jabatan, atau departemen..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div>
                        <Select
                            value={selectedCompanyId}
                            onChange={(e) => setSelectedCompanyId(e.target.value)}
                            options={[
                                { value: '', label: 'Semua Perusahaan' },
                                ...companies.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` }))
                            ]}
                        />
                    </div>

                    <div>
                        <Select
                            value={selectedDepartmentId}
                            onChange={(e) => setSelectedDepartmentId(e.target.value)}
                            options={[
                                { value: '', label: 'Semua Departemen' },
                                ...departments.map((d: any) => ({ value: d.id, label: d.name }))
                            ]}
                        />
                    </div>
                </div>
            </Card>

            {/* Data Table / List */}
            <Card className="border-slate-100 shadow-sm overflow-hidden bg-white">
                <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Struktur Hirarki Pegawai ({filteredNodes.length} Entri)
                    </span>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 animate-pulse">Loading organization structure...</div>
                ) : filteredNodes.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="mx-auto text-slate-300 mb-3" size={40} />
                        <p className="text-sm font-bold text-slate-700">Belum ada struktur organisasi terdaftar</p>
                        <p className="text-xs text-slate-400 mt-1">Klik tombol "+ Tambah Node Struktur" untuk menambahkan struktur bawahan & atasan.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase bg-slate-50/30">
                                    <th className="py-3 px-4">Perusahaan & Dept</th>
                                    <th className="py-3 px-4">Pegawai / User</th>
                                    <th className="py-3 px-4">Jabatan</th>
                                    <th className="py-3 px-4">Level</th>
                                    <th className="py-3 px-4">Atasan Langsung (Reports To)</th>
                                    <th className="py-3 px-4 text-center">Dept Head?</th>
                                    <th className="py-3 px-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredNodes.map((node: any) => (
                                    <tr key={node.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-3.5 px-4">
                                            <div className="font-semibold text-slate-800">{node.company_name || 'N/A'}</div>
                                            <span className="text-xs text-slate-400">{node.department_name}</span>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="font-bold text-slate-900">{node.user_full_name || node.user_name}</div>
                                            <span className="text-xs text-slate-500">@{node.user_name}</span>
                                        </td>
                                        <td className="py-3.5 px-4 font-medium text-slate-700">
                                            {node.position_title}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <Badge variant="outline" className="text-[10px] font-bold">
                                                Level {node.level_order}
                                            </Badge>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {node.reports_to_name ? (
                                                <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold">
                                                    <CornerDownRight size={14} />
                                                    <span>{node.reports_to_name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Top Level / Tidak ada atasan</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            {node.is_dept_head ? (
                                                <Badge variant="success" className="text-[10px]">DEPT HEAD</Badge>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right space-x-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEditOrgNode(node)}
                                                className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600"
                                            >
                                                <Edit2 size={15} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    if (confirm(`Hapus node ${node.user_full_name} dari struktur?`)) {
                                                        deleteOrgNodeMutation.mutate(node.id);
                                                    }
                                                }}
                                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                                            >
                                                <Trash2 size={15} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Modal Org Node Form */}
            {isOrgModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <Card className="w-full max-w-lg shadow-xl p-6 bg-white space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="text-lg font-bold text-slate-900">
                                {editingOrgNode ? 'Edit Struktur Organisasi' : 'Tambah Struktur Organisasi'}
                            </h3>
                            <button onClick={() => setIsOrgModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                saveOrgNodeMutation.mutate(orgFormData);
                            }}
                            className="space-y-4"
                        >
                            <Select
                                label="Perusahaan (Company) *"
                                value={orgFormData.company}
                                onChange={(e) => setOrgFormData({ ...orgFormData, company: e.target.value })}
                                options={[
                                    { value: '', label: 'Pilih Perusahaan' },
                                    ...companies.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` }))
                                ]}
                                required
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Select
                                    label="User"
                                    value={orgFormData.user}
                                    onChange={(e) => setOrgFormData({ ...orgFormData, user: e.target.value })}
                                    options={[
                                        { value: '', label: 'Pilih User' },
                                        ...users.map((u: any) => ({ value: u.id, label: `${u.first_name} ${u.last_name}`.trim() || u.username }))
                                    ]}
                                    required
                                />

                                <Select
                                    label="Departement *"
                                    value={orgFormData.department}
                                    onChange={(e) => setOrgFormData({ ...orgFormData, department: e.target.value })}
                                    options={[
                                        { value: '', label: 'Pilih Departemen' },
                                        ...departments.map((d: any) => ({ value: d.id, label: d.name }))
                                    ]}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <Input
                                        label="Nama Jabatan (Position Title) *"
                                        placeholder="e.g. Staff Purchasing, Manager Marketing"
                                        value={orgFormData.position_title}
                                        onChange={(e) => setOrgFormData({ ...orgFormData, position_title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Input
                                        label="Approval Level *"
                                        type="number"
                                        min={1}
                                        value={orgFormData.level_order}
                                        onChange={(e) => setOrgFormData({ ...orgFormData, level_order: parseInt(e.target.value) || 1 })}
                                        required
                                    />
                                </div>
                            </div>

                            <Select
                                label="Atasan Langsung (Reports To Manager)"
                                value={orgFormData.reports_to}
                                onChange={(e) => setOrgFormData({ ...orgFormData, reports_to: e.target.value })}
                                options={[
                                    { value: '', label: 'Tidak ada atasan (Top Level)' },
                                    ...users.map((u: any) => ({ value: u.id, label: `${u.first_name} ${u.last_name}`.trim() || u.username }))
                                ]}
                            />

                            <div className="flex items-center space-x-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="is_dept_head"
                                    checked={orgFormData.is_dept_head}
                                    onChange={(e) => setOrgFormData({ ...orgFormData, is_dept_head: e.target.checked })}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                />
                                <label htmlFor="is_dept_head" className="text-xs font-bold text-slate-700">
                                    Posisi ini adalah Department Head (Atasan Tertinggi Departemen)
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button type="button" variant="outline" onClick={() => setIsOrgModalOpen(false)}>
                                    Batal
                                </Button>
                                <Button type="submit" loading={saveOrgNodeMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                                    Simpan Node
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Modal Manage Companies */}
            {isCompanyModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <Card className="w-full max-w-md shadow-xl p-6 bg-white space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="text-lg font-bold text-slate-900">
                                {editingCompany ? 'Edit Perusahaan' : 'Tambah Perusahaan Baru'}
                            </h3>
                            <button onClick={() => setIsCompanyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                saveCompanyMutation.mutate(companyFormData);
                            }}
                            className="space-y-4"
                        >
                            <Input
                                label="Nama Perusahaan *"
                                placeholder="e.g. PT. Sinar Jaya Abadi"
                                value={companyFormData.name}
                                onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                                required
                            />

                            <Input
                                label="Kode Perusahaan *"
                                placeholder="e.g. PT_SJA"
                                value={companyFormData.code}
                                onChange={(e) => setCompanyFormData({ ...companyFormData, code: e.target.value.toUpperCase() })}
                                required
                            />

                            <Input
                                label="Deskripsi"
                                placeholder="Deskripsi singkat perusahaan..."
                                value={companyFormData.description}
                                onChange={(e) => setCompanyFormData({ ...companyFormData, description: e.target.value })}
                            />

                            <div className="flex items-center space-x-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="company_is_active"
                                    checked={companyFormData.is_active}
                                    onChange={(e) => setCompanyFormData({ ...companyFormData, is_active: e.target.checked })}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                />
                                <label htmlFor="company_is_active" className="text-xs font-bold text-slate-700">
                                    Perusahaan Aktif
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button type="button" variant="outline" onClick={() => setIsCompanyModalOpen(false)}>
                                    Batal
                                </Button>
                                <Button type="submit" loading={saveCompanyMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                                    Simpan Perusahaan
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};
