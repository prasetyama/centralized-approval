import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Edit2, Trash2, Search, CheckCircle2, XCircle, AlertCircle, Upload, FileSpreadsheet, Download, X, FileText } from 'lucide-react';
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
    ship_to: string | null;
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

    // Form inputs (Create / Edit)
    const [email, setEmail] = useState('');
    const [shipTo, setShipTo] = useState('');
    const [subject, setSubject] = useState('eorder information');
    const [customSubject, setCustomSubject] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    // CSV Import Modal states
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importSubject, setImportSubject] = useState('eorder information');
    const [importCustomSubject, setImportCustomSubject] = useState('');
    const [importError, setImportError] = useState('');
    const [importResult, setImportResult] = useState<{
        success?: boolean;
        message?: string;
        created_count?: number;
        updated_count?: number;
        skipped_count?: number;
        errors?: string[];
    } | null>(null);

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

    const importMutation = useMutation({
        mutationFn: async () => {
            if (!importFile) throw new Error('Silakan pilih file CSV terlebih dahulu');
            
            const formData = new FormData();
            formData.append('file', importFile);
            const targetSubject = importSubject === 'custom' ? importCustomSubject.trim() : importSubject;
            formData.append('subject', targetSubject);

            const res: any = await api.post('/admin/cc-email-configs/import-csv/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res;
        },
        onSuccess: (data: any) => {
            setImportResult(data);
            queryClient.invalidateQueries({ queryKey: ['cc-email-configs'] });
        },
        onError: (err: any) => {
            setImportError(typeof err === 'string' ? err : 'Gagal mengimpor file CSV');
        }
    });

    const openCreateModal = () => {
        setEditingConfig(null);
        setEmail('');
        setShipTo('');
        setSubject('eorder information');
        setCustomSubject('');
        setIsActive(true);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const openEditModal = (config: CCEmailConfig) => {
        setEditingConfig(config);
        setEmail(config.email);
        setShipTo(config.ship_to || '');
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

    const openImportModal = () => {
        setImportFile(null);
        setImportSubject('eorder information');
        setImportCustomSubject('');
        setImportError('');
        setImportResult(null);
        setIsImportModalOpen(true);
    };

    const closeImportModal = () => {
        setIsImportModalOpen(false);
        setImportFile(null);
        setImportError('');
        setImportResult(null);
    };

    const downloadSampleCsv = () => {
        const sampleContent = 'Ship_To,email\n0001001234,"user1@company.com, user2@company.com"\n0001005678,user3@company.com\n';
        const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'template_import_cc_email.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
            ship_to: shipTo.trim() || null,
            subject: targetSubject,
            is_active: isActive
        });
    };

    const handleImportSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setImportError('');
        setImportResult(null);

        if (!importFile) {
            setImportError('Silakan pilih file CSV terlebih dahulu');
            return;
        }

        if (importSubject === 'custom' && !importCustomSubject.trim()) {
            setImportError('Custom subject harus diisi');
            return;
        }

        importMutation.mutate();
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
                        Kelola alamat email CC otomatis berdasarkan subject tertentu dan Ship To code.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={openImportModal}
                        className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs"
                    >
                        <Upload size={18} className="text-slate-600" />
                        Import CSV
                    </Button>
                    <Button onClick={openCreateModal} className="flex items-center gap-2 shadow-xs">
                        <Plus size={18} />
                        Tambah Config CC Email
                    </Button>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <Card className="p-4 bg-white border border-slate-200/80 shadow-xs rounded-xl">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <Input
                            placeholder="Cari email, ship to, atau subject..."
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
            <Card className="bg-white border border-slate-200/80 shadow-xs rounded-xl overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 animate-pulse">
                        Memuat data konfig CC email...
                    </div>
                ) : configs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <Mail className="mx-auto mb-3 text-slate-300" size={40} />
                        <p className="font-semibold text-slate-700">Belum ada Konfig CC Email</p>
                        <p className="text-sm text-slate-400 mt-1">
                            Klik tombol 'Tambah Config CC Email' atau 'Import CSV' untuk menambahkan data.
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-slate-50/80">
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Ship To Code</TableHead>
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
                                    <TableCell>
                                        {config.ship_to ? (
                                            <Badge variant="outline" className="font-mono text-xs bg-slate-50 text-slate-700 border-slate-200">
                                                {config.ship_to}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">ALL (Semua Ship To)</span>
                                        )}
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
                                    Ship To Code
                                </label>
                                <Input
                                    type="text"
                                    placeholder="contoh: 0001001234 (opsional, kosongkan jika berlaku untuk semua)"
                                    value={shipTo}
                                    onChange={(e) => setShipTo(e.target.value)}
                                    className="w-full"
                                />
                            </div>

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

            {/* CSV Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet className="text-blue-600" size={22} />
                                <h3 className="font-bold text-slate-800 text-lg">
                                    Import CC Email dari CSV
                                </h3>
                            </div>
                            <button
                                onClick={closeImportModal}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleImportSubmit} className="p-6 space-y-4">
                            {importError && (
                                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={16} className="shrink-0" />
                                    <span>{importError}</span>
                                </div>
                            )}

                            {importResult ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2 font-bold text-emerald-900">
                                            <CheckCircle2 size={20} className="text-emerald-600" />
                                            <span>Import Selesai</span>
                                        </div>
                                        <p className="text-xs text-emerald-700">{importResult.message}</p>
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                                                +{importResult.created_count || 0} Ditambahkan
                                            </Badge>
                                            <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                                {importResult.updated_count || 0} Diperbarui
                                            </Badge>
                                            {(importResult.skipped_count || 0) > 0 && (
                                                <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                                                    {importResult.skipped_count} Dilewati
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {importResult.errors && importResult.errors.length > 0 && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                                            <span className="font-bold text-amber-800 block">Catatan / Warning:</span>
                                            <ul className="list-disc pl-4 space-y-0.5 text-amber-700 max-h-32 overflow-y-auto">
                                                {importResult.errors.map((err, idx) => (
                                                    <li key={idx}>{err}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <Button type="button" onClick={closeImportModal}>
                                            Selesai
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Format Helper Box */}
                                    <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-blue-900 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold flex items-center gap-1.5">
                                                <FileText size={15} className="text-blue-600" /> Format Kolom CSV:
                                            </span>
                                            <button
                                                type="button"
                                                onClick={downloadSampleCsv}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center gap-1 underline underline-offset-2"
                                            >
                                                <Download size={13} /> Unduh Contoh CSV
                                            </button>
                                        </div>
                                        <p className="text-slate-600 leading-relaxed">
                                            File CSV wajib memiliki header: <strong className="font-mono text-blue-900">Ship_To</strong> dan <strong className="font-mono text-blue-900">email</strong>.
                                            Jika terdapat multiple email untuk satu Ship To, pisahkan dengan koma (contoh: <code className="bg-white px-1 py-0.5 rounded border border-blue-200">user1@mail.com, user2@mail.com</code>).
                                        </p>
                                    </div>

                                    {/* Subject Selection */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Subject Email Target <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={importSubject}
                                            onChange={(e) => setImportSubject(e.target.value)}
                                            className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="eorder information">eorder information</option>
                                            <option value="custom">+ Subject Lain (Custom)</option>
                                        </select>
                                    </div>

                                    {importSubject === 'custom' && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                                Nama Subject Custom <span className="text-red-500">*</span>
                                            </label>
                                            <Input
                                                placeholder="Masukkan nama subject custom..."
                                                value={importCustomSubject}
                                                onChange={(e) => setImportCustomSubject(e.target.value)}
                                                required
                                                className="w-full"
                                            />
                                        </div>
                                    )}

                                    {/* File Dropzone */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Pilih File CSV <span className="text-red-500">*</span>
                                        </label>
                                        
                                        {!importFile ? (
                                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-colors">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <Upload className="w-8 h-8 mb-2 text-slate-400" />
                                                    <p className="text-xs text-slate-600 font-medium">
                                                        Klik untuk memilih file atau seret file CSV ke sini
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                        Format yang didukung: .csv
                                                    </p>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept=".csv"
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files[0]) {
                                                            setImportFile(e.target.files[0]);
                                                        }
                                                    }}
                                                    className="hidden"
                                                />
                                            </label>
                                        ) : (
                                            <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-200 rounded-xl">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <FileSpreadsheet className="text-blue-600 shrink-0" size={24} />
                                                    <div className="truncate">
                                                        <p className="text-sm font-semibold text-slate-800 truncate">
                                                            {importFile.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {(importFile.size / 1024).toFixed(1)} KB
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setImportFile(null)}
                                                    className="p-1 hover:bg-blue-100 text-slate-500 hover:text-slate-700 rounded-lg transition-colors"
                                                    title="Hapus file"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                        <Button type="button" variant="outline" onClick={closeImportModal}>
                                            Batal
                                        </Button>
                                        <Button type="submit" disabled={importMutation.isPending || !importFile}>
                                            {importMutation.isPending ? 'Mengimpor...' : 'Impor Data CSV'}
                                        </Button>
                                    </div>
                                </>
                            )}
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
