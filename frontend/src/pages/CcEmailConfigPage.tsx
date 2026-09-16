import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Edit2, Trash2, Search, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Badge } from '@/components/atoms/Badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/atoms/Table';
import { ConfirmationModal } from '@/components/molecules/ConfirmationModal';

interface CCEmailConfig {
    id: number;
    email: string;
    subject: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    created_by: number | null;
    created_by_username: string | null;
    created_by_full_name: string | null;
}

export const CcEmailConfigPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<CCEmailConfig | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Form inputs
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('eorder information');
    const [customSubject, setCustomSubject] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    // Check if user is admin
    const isAdmin = user?.role_level === 'ADMIN' || user?.is_superuser || user?.is_staff;

    // Query configs
    const { data: configs = [], isLoading } = useQuery<CCEmailConfig[]>({
        queryKey: ['cc-email-configs', debouncedSearch],
        queryFn: async () => {
            const res: any = await api.get('/admin/cc-email-configs', {
                params: { search: debouncedSearch }
            });
            return res.results || res;
        },
        enabled: isAdmin,
    });

    // Mutations
    const saveMutation = useMutation({
        mutationFn: async (payload: any) => {
            if (editingConfig) {
                return await api.put(`/admin/cc-email-configs/${editingConfig.id}/`, payload);
            } else {
                return await api.post('/admin/cc-email-configs/', payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cc-email-configs'] });
            closeModal();
        },
        onError: (err: any) => {
            setErrorMsg(typeof err === 'string' ? err : 'Failed to save configuration');
        }
    });

    const toggleActiveMutation = useMutation({
        mutationFn: async (id: number) => {
            return await api.post(`/admin/cc-email-configs/${id}/toggle-active/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cc-email-configs'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return await api.delete(`/admin/cc-email-configs/${id}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cc-email-configs'] });
            setDeletingId(null);
        }
    });

    const openCreateModal = () => {
        setEditingConfig(null);
        setEmail('');
        setSubject('eorder information');
        setCustomSubject('');
        setIsActive(true);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const openEditModal = (config: CCEmailConfig) => {
        setEditingConfig(config);
        setEmail(config.email);
        if (config.subject === 'eorder information') {
            setSubject('eorder information');
            setCustomSubject('');
        } else {
            setSubject('custom');
            setCustomSubject(config.subject);
        }
        setIsActive(config.is_active);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingConfig(null);
        setErrorMsg('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!email.trim()) {
            setErrorMsg('Email is required');
            return;
        }

        const targetSubject = subject === 'custom' ? customSubject.trim() : subject;
        if (!targetSubject) {
            setErrorMsg('Subject option is required');
            return;
        }

        saveMutation.mutate({
            email: email.trim(),
            subject: targetSubject,
            is_active: isActive
        });
    };

    if (!isAdmin) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <Card className="p-8 text-center bg-white border border-red-100 shadow-sm rounded-xl">
                    <div className="flex justify-center mb-4 text-red-500">
                        <AlertCircle size={48} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
                    <p className="text-slate-500 mt-2">
                        Halaman ini hanya dapat diakses oleh Administrator system.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Mail className="text-blue-600" size={26} />
                        Config Management CC Email
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Kelola alamat email CC otomatis berdasarkan subject tertentu (seperti <strong>eorder information</strong>).
                    </p>
                </div>
                <Button onClick={openCreateModal} className="flex items-center gap-2 shadow-sm">
                    <Plus size={18} />
                    Tambah Config CC Email
                </Button>
            </div>

            {/* Filter & Search Bar */}
            <Card className="p-4 bg-white border border-slate-200/80 shadow-sm rounded-xl">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <Input
                            placeholder="Cari email atau subject..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-slate-50 border-slate-200"
                        />
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                        Total Config: <span className="text-slate-900 font-bold">{configs.length}</span>
                    </div>
                </div>
            </Card>

            {/* Configs Table */}
            <Card className="bg-white border border-slate-200/80 shadow-sm rounded-xl overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 animate-pulse">
                        Memuat data konfig CC email...
                    </div>
                ) : configs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <Mail className="mx-auto mb-3 text-slate-300" size={40} />
                        <p className="font-semibold text-slate-700">Belum ada Konfig CC Email</p>
                        <p className="text-sm text-slate-400 mt-1">Klik tombol 'Tambah Config CC Email' untuk membuat konfig baru.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-slate-50/80">
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Email Address</TableHead>
                                <TableHead>Subject Email</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created At</TableHead>
                                <TableHead>Created By</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {configs.map((config, index) => (
                                <TableRow key={config.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="font-medium text-slate-400 text-xs">
                                        {index + 1}
                                    </TableCell>
                                    <TableCell className="font-semibold text-slate-800">
                                        {config.email}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-mono text-xs bg-blue-50 text-blue-700 border-blue-200">
                                            {config.subject}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <button
                                            onClick={() => toggleActiveMutation.mutate(config.id)}
                                            className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                                            title="Klik untuk mengubah status"
                                        >
                                            {config.is_active ? (
                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                                                    <CheckCircle2 size={13} /> Active
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-slate-100 text-slate-500 border-slate-200 flex items-center gap-1">
                                                    <XCircle size={13} /> Inactive
                                                </Badge>
                                            )}
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-500">
                                        {new Date(config.created_at).toLocaleString('id-ID', {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        })}
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-600">
                                        {config.created_by_full_name || config.created_by_username || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEditModal(config)}
                                                className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeletingId(config.id)}
                                                className="h-8 w-8 p-0 text-slate-600 hover:text-red-600 hover:bg-red-50"
                                                title="Hapus"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            {/* Add / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 text-lg">
                                {editingConfig ? 'Edit Config CC Email' : 'Tambah Config CC Email'}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {errorMsg && (
                                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-600 rounded-lg">
                                    {errorMsg}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Email Address <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="email"
                                    placeholder="contoh: manager@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Pilihan Subject Email <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="eorder information">eorder information</option>
                                    <option value="custom">+ Subject Lain (Custom)</option>
                                </select>
                            </div>

                            {subject === 'custom' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Nama Subject Custom <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        placeholder="Masukkan nama subject custom..."
                                        value={customSubject}
                                        onChange={(e) => setCustomSubject(e.target.value)}
                                        required
                                        className="w-full"
                                    />
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Status Config
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    <span className="ml-3 text-sm font-medium text-slate-700">
                                        {isActive ? 'Activate' : 'Inactive'}
                                    </span>
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button type="button" variant="outline" onClick={closeModal}>
                                    Batal
                                </Button>
                                <Button type="submit" disabled={saveMutation.isPending}>
                                    {saveMutation.isPending ? 'Saving...' : 'Simpan Config'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={deletingId !== null}
                onClose={() => setDeletingId(null)}
                onConfirm={() => {
                    if (deletingId) deleteMutation.mutate(deletingId);
                }}
                title="Hapus Konfig CC Email"
                description="Apakah Anda yakin ingin menghapus konfig CC Email ini?"
                confirmText="Hapus"
                variant="danger"
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
};
