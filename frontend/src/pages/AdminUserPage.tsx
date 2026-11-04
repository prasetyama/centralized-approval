import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Users, UserPlus, Shield, Building, Edit2, Trash2, Search, Filter, ArrowLeft, RotateCcw, X, AlertTriangle } from 'lucide-react';
import api from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Pagination } from '@/components/atoms/Pagination';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/atoms/Table';
import { useState, useEffect } from 'react';
import { UserForm } from '@/components/organisms/UserForm';

export const AdminUserPage = () => {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [isAdding, setIsAdding] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);

    // SIT Cleanup Modal state
    const [sitCleanupModalOpen, setSitCleanupModalOpen] = useState(false);
    const [sitTargetUser, setSitTargetUser] = useState<any>(null);
    const [removeSitRole, setRemoveSitRole] = useState(true);
    const [resetSequences, setResetSequences] = useState(true);
    const [sitPreview, setSitPreview] = useState<any>(null);
    const [sitPreviewLoading, setSitPreviewLoading] = useState(false);

    const openSitCleanupModal = async (targetUser: any = null) => {
        setSitTargetUser(targetUser);
        setRemoveSitRole(true);
        setResetSequences(true);
        setSitCleanupModalOpen(true);
        setSitPreviewLoading(true);
        try {
            const res: any = await api.post('/admin/users/cleanup-sit/', {
                user_id: targetUser?.id || null,
                remove_sit_role: true,
                reset_sequences: true,
                dry_run: true,
            });
            setSitPreview(res?.data || res);
        } catch (err: any) {
            addToast(typeof err === 'string' ? err : 'Gagal memuat preview data SIT', 'error');
        } finally {
            setSitPreviewLoading(false);
        }
    };

    const cleanupSitMutation = useMutation({
        mutationFn: () =>
            api.post('/admin/users/cleanup-sit/', {
                user_id: sitTargetUser?.id || null,
                remove_sit_role: removeSitRole,
                reset_sequences: resetSequences,
                dry_run: false,
            }) as Promise<any>,
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            addToast(res?.message || 'Data testing SIT berhasil dibersihkan', 'success');
            setSitCleanupModalOpen(false);
            setSitTargetUser(null);
            setSitPreview(null);
        },
        onError: (err: any) => {
            addToast(typeof err === 'string' ? err : 'Gagal membersihkan data SIT', 'error');
        },
    });

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const { data: users, isLoading: usersLoading, isFetching: usersFetching } = useQuery({
        queryKey: ['admin-users', debouncedSearch, page, pageSize],
        queryFn: () => api.get('/admin/users', { params: { search: debouncedSearch, page, page_size: pageSize } }) as Promise<any>,
        placeholderData: keepPreviousData,
    });

    if (usersLoading) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">Loading user management...</div>;
    }

    if (isAdding || editingUser) {
        return (
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    onClick={() => { setIsAdding(false); setEditingUser(null); }}
                    className="gap-2 text-slate-500 hover:text-slate-900"
                >
                    <ArrowLeft size={16} /> Back to List
                </Button>
                <UserForm
                    initialData={editingUser}
                    onClose={() => { setIsAdding(false); setEditingUser(null); }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">User Management</h1>
                    <p className="mt-1 text-slate-500">Manage system users, roles, and department assignments.</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                        onClick={() => openSitCleanupModal(null)}
                    >
                        <RotateCcw size={16} /> Cleanup SIT Data (Go-Live)
                    </Button>
                    <Button variant="outline" className="gap-2">
                        <Shield size={16} /> Manage Roles
                    </Button>
                    <Button className="gap-2" onClick={() => setIsAdding(true)}>
                        <UserPlus size={16} /> Add User
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-6 bg-blue-50/30 border-blue-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-100/50 rounded-xl text-blue-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Users</p>
                        <p className="text-2xl font-black text-slate-900">{users?.count || 0}</p>
                    </div>
                </Card>
                {/* Additional summary cards can go here */}
            </div>

            <Card>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                        />
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                        <Filter size={14} /> Filter
                    </Button>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>No</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Division</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className={usersFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                        {(users?.results || []).map((user: any, index: number) => {
                            const initial = (user.first_name?.[0] || user.username?.[0] || 'U').toUpperCase();
                            const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'User';

                            return (
                                <TableRow key={user.id}>
                                    <TableCell>{((page - 1) * pageSize) + index + 1}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                                                {initial}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{fullName}</p>
                                                <p className="text-xs text-slate-400">@{user.username}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            <p className="font-bold text-slate-900">{user.email}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {user.role_name && user.role_code?.toUpperCase() !== 'SIT' ? (
                                                <Badge variant="secondary" className="font-bold tracking-tight">
                                                    {user.role_name}
                                                </Badge>
                                            ) : !user.is_sit ? (
                                                <Badge variant="secondary" className="font-bold tracking-tight">
                                                    {user.role_name || 'No Role'}
                                                </Badge>
                                            ) : null}
                                            {(user.is_sit || user.role_code?.toUpperCase() === 'SIT') && (
                                                <Badge variant="warning" className="font-bold tracking-tight">
                                                    SIT
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                            <span className="text-sm font-medium">{user.division_name || user.division || '-'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                            <Building size={14} className="text-slate-400" />
                                            <span className="text-sm font-medium">{user.department || '-'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.is_active ? 'success' : 'secondary'}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {(user.is_sit || user.role_code?.toUpperCase() === 'SIT') && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Cleanup SIT Data & Siap Go-Live"
                                                    className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                                                    onClick={() => openSitCleanupModal(user)}
                                                >
                                                    <RotateCcw size={16} />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => { setEditingUser(user); setIsAdding(true); }}>
                                                <Edit2 size={16} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600">
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {(!users?.results || users.results.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <Users className="h-10 w-10 opacity-20 mb-2" />
                                        <p className="text-base font-medium">No users found</p>
                                        <p className="text-xs text-slate-400">Try adjusting your search criteria</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                {users?.count !== undefined && users.count > 0 && (
                    <Pagination
                        currentPage={page}
                        pageSize={pageSize}
                        totalCount={users.count}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                )}
            </Card>

            {sitCleanupModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <Card className="w-full max-w-lg p-6 space-y-5 bg-white shadow-xl border-slate-200">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
                                    <AlertTriangle size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">
                                        {sitTargetUser ? `Cleanup Data SIT: @${sitTargetUser.username}` : 'Cleanup Semua Data Testing (SIT)'}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Bersihkan data sampah transaksi testing agar akun siap digunakan untuk Go-Live Production.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSitCleanupModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {sitPreviewLoading ? (
                            <div className="py-6 text-center text-sm text-slate-500 animate-pulse">
                                Menghitung jumlah transaksi testing SIT...
                            </div>
                        ) : sitPreview ? (
                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">User Terdampak:</span>
                                    <span className="font-semibold text-slate-900">
                                        {sitPreview.affected_users?.length ? sitPreview.affected_users.join(', ') : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Approval Request Dihapus:</span>
                                    <span className="font-bold text-red-600">{sitPreview.approval_requests_deleted || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">PR Non-Trade Dihapus:</span>
                                    <span className="font-bold text-red-600">{sitPreview.pr_non_trade_deleted || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Approval Step & Audit Log Dihapus:</span>
                                    <span className="font-semibold text-slate-700">
                                        {(sitPreview.approval_steps_deleted || 0) + (sitPreview.audit_logs_deleted || 0)}
                                    </span>
                                </div>
                            </div>
                        ) : null}

                        <div className="space-y-3 pt-1">
                            <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={resetSequences}
                                    onChange={(e) => setResetSequences(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                                <span className="text-sm text-slate-700">
                                    <strong>Reset Nomor Urut PR Non-Trade</strong> kembali mengikuti nomor terakhir transaksi Production.
                                </span>
                            </label>
                            <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={removeSitRole}
                                    onChange={(e) => setRemoveSitRole(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 text-amber-600 border-gray-300 rounded"
                                />
                                <span className="text-sm text-slate-700">
                                    <strong>Cabut Role SIT setelah pembersihan</strong> (jadikan user sebagai akun Production / Go-Live).
                                </span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSitCleanupModalOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                disabled={cleanupSitMutation.isPending || sitPreviewLoading}
                                onClick={() => cleanupSitMutation.mutate()}
                                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                            >
                                <RotateCcw size={15} />
                                {cleanupSitMutation.isPending ? 'Membersihkan...' : 'Bersihkan Data SIT Sekarang'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
