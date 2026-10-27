import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Building2, Users, Plus, Edit2, Trash2, Search,
    X, ShieldCheck, UserPlus,
    UserCheck, FolderTree
} from 'lucide-react';
import api from '@/services/api';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';

export const AdminOrgStructurePage = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'departments' | 'members'>('departments');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [isDeptMembersModalOpen, setIsDeptMembersModalOpen] = useState(false);

    // Selected / Editing Entities
    const [editingDept, setEditingDept] = useState<any>(null);
    const [editingCompany, setEditingCompany] = useState<any>(null);
    const [activeDepartment, setActiveDepartment] = useState<any>(null);

    // Department Form State (Approver 1, 2, 3)
    const [deptFormData, setDeptFormData] = useState({
        name: '',
        code: '',
        company: '',
        approver_1: '',
        approver_2: '',
        approver_3: '',
        description: '',
    });

    // Mapping Form State (Mapping user ke department)
    const [mappingFormData, setMappingFormData] = useState({
        department: '',
        user_ids: [] as string[],
        position_title: 'Staff / Requestor',
    });

    // Quick Add Single Member State (Inside Dept Members Modal)
    const [quickAddUserId, setQuickAddUserId] = useState('');
    const [quickAddTitle, setQuickAddTitle] = useState('Staff / Requestor');

    // Company Form State
    const [companyFormData, setCompanyFormData] = useState({
        name: '',
        code: '',
        description: '',
        is_active: true,
    });

    // ─────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────
    const { data: companiesData } = useQuery<any>({
        queryKey: ['admin-companies'],
        queryFn: () => api.get('/admin/companies'),
    });

    const { data: departmentsData, isLoading: isDeptsLoading } = useQuery<any>({
        queryKey: ['admin-departments', selectedCompanyId],
        queryFn: () => {
            const params: any = {};
            if (selectedCompanyId) params.company = selectedCompanyId;
            return api.get('/admin/departments', { params });
        },
    });

    const { data: usersData } = useQuery<any>({
        queryKey: ['admin-users'],
        queryFn: () => api.get('/admin/users', { params: { is_active: true, page_size: 1000 } }),
    });

    const { data: orgStructuresData, isLoading: isOrgLoading } = useQuery<any>({
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

    // Invalidation helper
    const refreshAll = () => {
        queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
        queryClient.invalidateQueries({ queryKey: ['admin-org-structures'] });
    };

    // ─────────────────────────────────────────────
    // Mutations: Department
    // ─────────────────────────────────────────────
    const saveDeptMutation = useMutation({
        mutationFn: (data: any) => {
            const payload: any = {
                name: data.name,
                code: data.code,
                company: data.company || null,
                approver_1: data.approver_1 || null,
                approver_2: data.approver_2 || null,
                approver_3: data.approver_3 || null,
                description: data.description || '',
            };
            if (editingDept?.id) {
                return api.put(`/admin/departments/${editingDept.id}/`, payload);
            }
            return api.post('/admin/departments/', payload);
        },
        onSuccess: () => {
            refreshAll();
            setIsDeptModalOpen(false);
            setEditingDept(null);
        },
        onError: (err: any) => alert(err?.message || 'Gagal menyimpan departemen'),
    });

    const deleteDeptMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/admin/departments/${id}/`),
        onSuccess: () => {
            refreshAll();
        },
        onError: (err: any) => alert(err?.message || 'Gagal menghapus departemen'),
    });

    // ─────────────────────────────────────────────
    // Mutations: Mapping Members
    // ─────────────────────────────────────────────
    const assignMembersMutation = useMutation({
        mutationFn: ({ deptId, userIds, positionTitle }: { deptId: number | string; userIds: (number | string)[]; positionTitle?: string }) => {
            return api.post(`/admin/departments/${deptId}/assign-members/`, {
                user_ids: userIds,
                position_title: positionTitle || 'Staff / Requestor',
            });
        },
        onSuccess: (res: any) => {
            refreshAll();
            setIsMappingModalOpen(false);
            setQuickAddUserId('');
            // If viewing active department members modal, update its members view
            if (activeDepartment) {
                setActiveDepartment((prev: any) => ({
                    ...prev,
                    members: res.members,
                    members_count: res.members?.length || 0,
                }));
            }
        },
        onError: (err: any) => alert(err?.message || 'Gagal memetakan pegawai'),
    });

    const removeMemberMutation = useMutation({
        mutationFn: ({ deptId, userId, orgId }: { deptId: number | string; userId?: number; orgId?: number }) => {
            return api.post(`/admin/departments/${deptId}/remove-member/`, {
                user_id: userId,
                org_id: orgId,
            });
        },
        onSuccess: (res: any) => {
            refreshAll();
            if (activeDepartment) {
                setActiveDepartment((prev: any) => ({
                    ...prev,
                    members: res.members,
                    members_count: res.members?.length || 0,
                }));
            }
        },
        onError: (err: any) => alert(err?.message || 'Gagal menghapus pegawai dari departemen'),
    });

    const deleteOrgNodeMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/admin/org-structures/${id}/`),
        onSuccess: () => {
            refreshAll();
        },
        onError: (err: any) => alert(err?.message || 'Gagal menghapus struktur pegawai'),
    });

    // ─────────────────────────────────────────────
    // Mutations: Company
    // ─────────────────────────────────────────────
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
        onError: (err: any) => alert(err?.message || 'Gagal menyimpan perusahaan'),
    });

    // ─────────────────────────────────────────────
    // Modal Openers
    // ─────────────────────────────────────────────
    const openAddDept = () => {
        setEditingDept(null);
        setDeptFormData({
            name: '',
            code: '',
            company: selectedCompanyId || (companies[0]?.id?.toString() || ''),
            approver_1: '',
            approver_2: '',
            approver_3: '',
            description: '',
        });
        setIsDeptModalOpen(true);
    };

    const openEditDept = (dept: any) => {
        setEditingDept(dept);
        setDeptFormData({
            name: dept.name,
            code: dept.code,
            company: dept.company?.toString() || '',
            approver_1: dept.approver_1?.toString() || '',
            approver_2: dept.approver_2?.toString() || '',
            approver_3: dept.approver_3?.toString() || '',
            description: dept.description || '',
        });
        setIsDeptModalOpen(true);
    };

    const openMappingModal = (defaultDeptId?: string) => {
        setMappingFormData({
            department: defaultDeptId || selectedDepartmentId || (departments[0]?.id?.toString() || ''),
            user_ids: [],
            position_title: 'Staff / Requestor',
        });
        setIsMappingModalOpen(true);
    };

    const openDeptMembersModal = (dept: any) => {
        setActiveDepartment(dept);
        setQuickAddUserId('');
        setQuickAddTitle('Staff / Requestor');
        setIsDeptMembersModalOpen(true);
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

    // ─────────────────────────────────────────────
    // Filtered Lists
    // ─────────────────────────────────────────────
    const filteredDepartments = departments.filter((dept: any) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            dept.name?.toLowerCase().includes(term) ||
            dept.code?.toLowerCase().includes(term) ||
            dept.company_name?.toLowerCase().includes(term) ||
            dept.approver_1_name?.toLowerCase().includes(term) ||
            dept.approver_2_name?.toLowerCase().includes(term) ||
            dept.approver_3_name?.toLowerCase().includes(term)
        );
    });

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
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
                        <FolderTree className="text-indigo-600" size={28} />
                        Master Organization Structure & Approvers
                    </h1>
                    <p className="mt-1 text-slate-500 text-sm">
                        Kelola struktur Departemen beserta hirarki persetujuan (Approver 1, 2, 3), lalu tambahkan requestor untuk alur otomatis <strong>Request Department Approval</strong>.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                        variant="outline"
                        onClick={() => openCompanyModal()}
                        className="gap-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                    >
                        <Building2 size={15} className="text-slate-500" />
                        Tambah Perusahaan ({companies.length})
                    </Button>
                    <Button
                        onClick={() => openMappingModal()}
                        variant="outline"
                        className="gap-2 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 text-xs font-semibold"
                    >
                        <UserPlus size={15} />
                        Tambah Requestor
                    </Button>
                    <Button
                        onClick={openAddDept}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-sm text-xs font-semibold"
                    >
                        <Plus size={15} />
                        Tambah Departemen
                    </Button>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex border-b border-slate-200 text-sm font-semibold">
                <button
                    onClick={() => setActiveTab('departments')}
                    className={`flex items-center gap-2 py-3 px-5 border-b-2 transition-all ${activeTab === 'departments'
                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                >
                    <Building2 size={17} />
                    Departemen & Approvers
                    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-bold">
                        {departments.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('members')}
                    className={`flex items-center gap-2 py-3 px-5 border-b-2 transition-all ${activeTab === 'members'
                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                >
                    <Users size={17} />
                    Requestors
                    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-bold">
                        {orgNodes.length}
                    </span>
                </button>
            </div>

            {/* Filter Bar */}
            <Card className="p-4 border-slate-200/80 shadow-xs bg-white">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                    <div className="relative col-span-1 md:col-span-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            placeholder={activeTab === 'departments' ? "Cari nama departemen, kode, atau nama approver..." : "Cari nama pegawai, jabatan, atau departemen..."}
                            className="pl-9 text-sm"
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

                    {activeTab === 'members' && (
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
                    )}
                </div>
            </Card>

            {/* ─────────────────────────────────────────────
                TAB 1: Departemen & Approvers List
               ───────────────────────────────────────────── */}
            {activeTab === 'departments' && (
                <Card className="border-slate-200/80 shadow-xs overflow-hidden bg-white">
                    <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Daftar Departemen & Approver Bertingkat ({filteredDepartments.length} Departemen)
                            </span>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Approver 1 (SPV/Lvl 1) → Approver 2 (Dept Head/Lvl 2) → Approver 3 (Director/Lvl 3)
                            </p>
                        </div>
                        <Button onClick={openAddDept} size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold">
                            <Plus size={14} /> Tambah Departemen
                        </Button>
                    </div>

                    {isDeptsLoading ? (
                        <div className="p-12 text-center text-slate-400 animate-pulse">Memuat daftar departemen...</div>
                    ) : filteredDepartments.length === 0 ? (
                        <div className="p-12 text-center">
                            <Building2 className="mx-auto text-slate-300 mb-3" size={42} />
                            <p className="text-sm font-bold text-slate-700">Belum ada departemen terdaftar</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                Klik tombol <strong>Tambah Departemen</strong> untuk mendaftarkan nama departemen beserta Approver 1, Approver 2, dan Approver 3.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase bg-slate-50/40">
                                        <th className="py-3 px-4">Departemen & Kode</th>
                                        <th className="py-3 px-4">Perusahaan</th>
                                        <th className="py-3 px-4">Approver 1 (SPV/Lvl 1)</th>
                                        <th className="py-3 px-4">Approver 2 (Dept Head)</th>
                                        <th className="py-3 px-4">Approver 3 (Director)</th>
                                        <th className="py-3 px-4 text-center">Anggota Requestor</th>
                                        <th className="py-3 px-4 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {filteredDepartments.map((dept: any) => (
                                        <tr key={dept.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-slate-900">{dept.name}</div>
                                                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {dept.code}
                                                </span>
                                            </td>

                                            <td className="py-3.5 px-4">
                                                {dept.company_name ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                        <Building2 size={12} className="text-slate-400" />
                                                        {dept.company_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">Semua Perusahaan</span>
                                                )}
                                            </td>

                                            {/* Approver 1 */}
                                            <td className="py-3.5 px-4">
                                                {dept.approver_1_name ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                                                            1
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-800">{dept.approver_1_name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-300 italic">Belum diatur</span>
                                                )}
                                            </td>

                                            {/* Approver 2 */}
                                            <td className="py-3.5 px-4">
                                                {dept.approver_2_name ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                                                            2
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-800">{dept.approver_2_name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-300 italic">Belum diatur</span>
                                                )}
                                            </td>

                                            {/* Approver 3 */}
                                            <td className="py-3.5 px-4">
                                                {dept.approver_3_name ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">
                                                            3
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-800">{dept.approver_3_name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </td>

                                            {/* Members count button */}
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    onClick={() => openDeptMembersModal(dept)}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-semibold transition-colors"
                                                    title="Lihat & Kelola Anggota Departemen"
                                                >
                                                    <Users size={13} />
                                                    <span>{dept.members_count || 0} Requestor</span>
                                                </button>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 text-right space-x-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openDeptMembersModal(dept)}
                                                    className="h-8 px-2 text-indigo-600 hover:bg-indigo-50 text-xs gap-1"
                                                    title="Kelola Requestor"
                                                >
                                                    <UserCheck size={14} /> Kelola Requestor
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEditDept(dept)}
                                                    className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600"
                                                    title="Edit Departemen & Approver"
                                                >
                                                    <Edit2 size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (confirm(`Hapus departemen "${dept.name}"?`)) {
                                                            deleteDeptMutation.mutate(dept.id);
                                                        }
                                                    }}
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                                                    title="Hapus Departemen"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* ─────────────────────────────────────────────
                TAB 2: Pemetaan Pegawai (Requestors) List
               ───────────────────────────────────────────── */}
            {activeTab === 'members' && (
                <Card className="border-slate-200/80 shadow-xs overflow-hidden bg-white">
                    <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Daftar Requestor ({filteredNodes.length})
                            </span>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Requestor yang ditambahkan akan otomatis mengikuti hirarki approver departemennya saat mengajukan approval.
                            </p>
                        </div>
                        <Button onClick={() => openMappingModal()} size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold">
                            <UserPlus size={14} /> Tambah Requestor
                        </Button>
                    </div>

                    {isOrgLoading ? (
                        <div className="p-12 text-center text-slate-400 animate-pulse">Memuat pemetaan Requestor...</div>
                    ) : filteredNodes.length === 0 ? (
                        <div className="p-12 text-center">
                            <Users className="mx-auto text-slate-300 mb-3" size={42} />
                            <p className="text-sm font-bold text-slate-700">Belum ada Requestor yang dimapping ke departemen</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                Klik tombol <strong>Petakan Pegawai Baru</strong> untuk memasukkan nama pegawai ke dalam departemen mereka.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase bg-slate-50/40">
                                        <th className="py-3 px-4">Pegawai / Requestor</th>
                                        <th className="py-3 px-4">Departemen</th>
                                        <th className="py-3 px-4">Perusahaan</th>
                                        <th className="py-3 px-4">Jabatan</th>
                                        <th className="py-3 px-4 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {filteredNodes.map((node: any) => (
                                        <tr key={node.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-slate-900">{node.user_full_name || node.user_name}</div>
                                                <span className="text-xs text-slate-500">@{node.user_name}</span>
                                            </td>

                                            <td className="py-3.5 px-4">
                                                <Badge variant="info" className="text-xs font-semibold">
                                                    {node.department_name}
                                                </Badge>
                                            </td>

                                            <td className="py-3.5 px-4 text-xs text-slate-600">
                                                {node.company_name || 'N/A'}
                                            </td>

                                            <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                                                {node.position_title || 'Staff / Requestor'}
                                            </td>

                                            <td className="py-3.5 px-4 text-right space-x-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (confirm(`Hapus pemetaan pegawai ${node.user_full_name || node.user_name} dari departemen ${node.department_name}?`)) {
                                                            deleteOrgNodeMutation.mutate(node.id);
                                                        }
                                                    }}
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                                                    title="Hapus Pemetaan Pegawai"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* ─────────────────────────────────────────────
                MODAL: Tambah / Edit Departemen (Approver 1, 2, 3)
               ───────────────────────────────────────────── */}
            {isDeptModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <Card className="w-full max-w-xl shadow-2xl p-6 bg-white space-y-4 rounded-2xl">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    {editingDept ? 'Edit Departemen & Approver' : 'Tambah Departemen & Approver Baru'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Tentukan nama departemen dan urutan approver (Approver 1, 2, dan 3).
                                </p>
                            </div>
                            <button onClick={() => setIsDeptModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                saveDeptMutation.mutate(deptFormData);
                            }}
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    label="Nama Departemen"
                                    placeholder="e.g. Information Technology"
                                    value={deptFormData.name}
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        setDeptFormData(prev => ({
                                            ...prev,
                                            name,
                                            // Auto-generate code if not editing existing
                                            code: editingDept ? prev.code : `DEPT_${name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
                                        }));
                                    }}
                                    required
                                />

                                <Input
                                    label="Kode Departemen"
                                    placeholder="e.g. DEPT_IT"
                                    value={deptFormData.code}
                                    onChange={(e) => setDeptFormData({ ...deptFormData, code: e.target.value.toUpperCase() })}
                                    required
                                />
                            </div>

                            <Select
                                label="Perusahaan"
                                value={deptFormData.company}
                                onChange={(e) => setDeptFormData({ ...deptFormData, company: e.target.value })}
                                options={[
                                    { value: '', label: 'Semua Perusahaan (General)' },
                                    ...companies.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` }))
                                ]}
                            />

                            {/* Approver Selection Section */}
                            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3.5">
                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                                    <ShieldCheck size={16} />
                                    <span>Hirarki Persetujuan</span>
                                </div>

                                <div className="space-y-3">
                                    <Select
                                        label="Approver 1"
                                        value={deptFormData.approver_1}
                                        onChange={(e) => setDeptFormData({ ...deptFormData, approver_1: e.target.value })}
                                        options={[
                                            { value: '', label: '-- Pilih Approver 1 --' },
                                            ...users.map((u: any) => ({
                                                value: u.id,
                                                label: `${u.first_name} ${u.last_name}`.trim() || u.username
                                            }))
                                        ]}
                                    />

                                    <Select
                                        label="Approver 2"
                                        value={deptFormData.approver_2}
                                        onChange={(e) => setDeptFormData({ ...deptFormData, approver_2: e.target.value })}
                                        options={[
                                            { value: '', label: '-- Pilih Approver 2 --' },
                                            ...users.map((u: any) => ({
                                                value: u.id,
                                                label: `${u.first_name} ${u.last_name}`.trim() || u.username
                                            }))
                                        ]}
                                    />

                                    <Select
                                        label="Approver 3"
                                        value={deptFormData.approver_3}
                                        onChange={(e) => setDeptFormData({ ...deptFormData, approver_3: e.target.value })}
                                        options={[
                                            { value: '', label: '-- Tidak Ada (Opsional) --' },
                                            ...users.map((u: any) => ({
                                                value: u.id,
                                                label: `${u.first_name} ${u.last_name}`.trim() || u.username
                                            }))
                                        ]}
                                    />
                                </div>
                            </div>

                            <Input
                                label="Deskripsi (Opsional)"
                                placeholder="Deskripsi singkat fungsi departemen..."
                                value={deptFormData.description}
                                onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                            />

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button type="button" variant="outline" onClick={() => setIsDeptModalOpen(false)}>
                                    Batal
                                </Button>
                                <Button type="submit" loading={saveDeptMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                                    Simpan Departemen
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* ─────────────────────────────────────────────
                MODAL: Petakan Pegawai / Requestor ke Departemen
               ───────────────────────────────────────────── */}
            {isMappingModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <Card className="w-full max-w-lg shadow-2xl p-6 bg-white space-y-4 rounded-2xl">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Tambah Requestor ke Departemen</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Pilih user yang akan ditambahkan sebagai requestor.
                                </p>
                            </div>
                            <button onClick={() => setIsMappingModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!mappingFormData.department) {
                                    alert('Silakan pilih departemen');
                                    return;
                                }
                                if (mappingFormData.user_ids.length === 0) {
                                    alert('Silakan pilih minimal 1 user');
                                    return;
                                }
                                assignMembersMutation.mutate({
                                    deptId: mappingFormData.department,
                                    userIds: mappingFormData.user_ids,
                                    positionTitle: mappingFormData.position_title,
                                });
                            }}
                            className="space-y-4"
                        >
                            <Select
                                label="Departemen "
                                value={mappingFormData.department}
                                onChange={(e) => setMappingFormData({ ...mappingFormData, department: e.target.value })}
                                options={[
                                    { value: '', label: '-- Pilih Departemen --' },
                                    ...departments.map((d: any) => ({ value: d.id, label: `${d.name} (${d.code})` }))
                                ]}
                                required
                            />

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">
                                    Pilih User*
                                </label>
                                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50/50">
                                    {users.map((u: any) => {
                                        const isChecked = mappingFormData.user_ids.includes(u.id.toString());
                                        return (
                                            <label
                                                key={u.id}
                                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors text-xs ${isChecked ? 'bg-indigo-50 border border-indigo-200 font-semibold text-indigo-900' : 'hover:bg-white text-slate-700'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const idStr = u.id.toString();
                                                        if (e.target.checked) {
                                                            setMappingFormData(prev => ({
                                                                ...prev,
                                                                user_ids: [...prev.user_ids, idStr]
                                                            }));
                                                        } else {
                                                            setMappingFormData(prev => ({
                                                                ...prev,
                                                                user_ids: prev.user_ids.filter(id => id !== idStr)
                                                            }));
                                                        }
                                                    }}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                                />
                                                <div className="flex-1 truncate">
                                                    <span>{u.first_name} {u.last_name}</span>
                                                    <span className="text-slate-400 ml-1.5">(@{u.username})</span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                                <span className="text-[11px] text-slate-400">
                                    {mappingFormData.user_ids.length} user terpilih
                                </span>
                            </div>

                            <Input
                                label="Jabatan Pegawai (Position Title)"
                                placeholder="e.g. Staff / Requestor / Marketing Officer"
                                value={mappingFormData.position_title}
                                onChange={(e) => setMappingFormData({ ...mappingFormData, position_title: e.target.value })}
                            />

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button type="button" variant="outline" onClick={() => setIsMappingModalOpen(false)}>
                                    Batal
                                </Button>
                                <Button type="submit" loading={assignMembersMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                                    Simpan Pemetaan
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* ─────────────────────────────────────────────
                MODAL: Kelola Anggota Departemen (Detail)
               ───────────────────────────────────────────── */}
            {isDeptMembersModalOpen && activeDepartment && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <Card className="w-full max-w-2xl shadow-2xl p-6 bg-white space-y-4 rounded-2xl max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Users className="text-indigo-600" size={20} />
                                    Anggota Departemen: {activeDepartment.name}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Daftar requestor yang terdaftar pada departemen ini.
                                </p>
                            </div>
                            <button onClick={() => setIsDeptMembersModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Quick Add Member Form */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-2.5">
                            <div className="flex-1 w-full">
                                <Select
                                    value={quickAddUserId}
                                    onChange={(e) => setQuickAddUserId(e.target.value)}
                                    options={[
                                        { value: '', label: '-- Pilih user untuk ditambahkan --' },
                                        ...users.map((u: any) => ({
                                            value: u.id,
                                            label: `${u.first_name} ${u.last_name}`.trim() || u.username
                                        }))
                                    ]}
                                />
                            </div>
                            <div className="w-full sm:w-44">
                                <Input
                                    placeholder="Jabatan (e.g. Staff)"
                                    value={quickAddTitle}
                                    onChange={(e) => setQuickAddTitle(e.target.value)}
                                    className="text-xs"
                                />
                            </div>
                            <Button
                                onClick={() => {
                                    if (!quickAddUserId) {
                                        alert('Pilih pegawai terlebih dahulu');
                                        return;
                                    }
                                    assignMembersMutation.mutate({
                                        deptId: activeDepartment.id,
                                        userIds: [quickAddUserId],
                                        positionTitle: quickAddTitle,
                                    });
                                }}
                                disabled={!quickAddUserId || assignMembersMutation.isPending}
                                size="sm"
                                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold whitespace-nowrap"
                            >
                                + Tambah
                            </Button>
                        </div>

                        {/* Members List Table */}
                        <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl">
                            {(!activeDepartment.members || activeDepartment.members.length === 0) ? (
                                <div className="p-8 text-center text-slate-400">
                                    <Users size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-xs font-semibold">Belum ada requestor di departemen ini.</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Gunakan form di atas untuk menambahkan pegawai.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                        <tr>
                                            <th className="py-2.5 px-3">Pegawai / Requestor</th>
                                            <th className="py-2.5 px-3">Jabatan</th>
                                            <th className="py-2.5 px-3">Email</th>
                                            <th className="py-2.5 px-3 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {activeDepartment.members.map((m: any) => (
                                            <tr key={m.id || m.org_id} className="hover:bg-slate-50">
                                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                                    <div>{m.full_name}</div>
                                                    <span className="text-[10px] text-slate-400 font-normal">@{m.username}</span>
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-600 font-medium">
                                                    {m.position_title || 'Staff / Requestor'}
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-500">
                                                    {m.email || '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (confirm(`Keluarkan ${m.full_name} dari departemen ${activeDepartment.name}?`)) {
                                                                removeMemberMutation.mutate({
                                                                    deptId: activeDepartment.id,
                                                                    userId: m.id,
                                                                    orgId: m.org_id,
                                                                });
                                                            }
                                                        }}
                                                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                                        title="Keluarkan dari departemen"
                                                    >
                                                        <Trash2 size={13} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-100">
                            <Button variant="outline" size="sm" onClick={() => setIsDeptMembersModalOpen(false)}>
                                Tutup
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* ─────────────────────────────────────────────
                MODAL: Kelola Perusahaan (Company)
               ───────────────────────────────────────────── */}
            {isCompanyModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <Card className="w-full max-w-md shadow-2xl p-6 bg-white space-y-4 rounded-2xl">
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
