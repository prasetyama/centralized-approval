import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    CalendarOff,
    Plus,
    UserCheck,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Clock,
    Trash2,
    Calendar,
    ArrowRight,
    Users,
    ShieldCheck,
    Info,
    Check,
    Search,
    Loader2,
    X
} from 'lucide-react';
import api from '@/services/api';
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

interface LeaveDelegation {
    id: number;
    user: number;
    user_name: string;
    user_email: string;
    user_department: string;
    delegate_user: number;
    delegate_user_name: string;
    delegate_user_email: string;
    delegate_user_department: string;
    start_date: string;
    end_date: string;
    reason: string;
    is_active: boolean;
    scope: 'ALL' | 'SPECIFIC_MODULE';
    specific_module_codes: string[];
    notify_delegate: boolean;
    current_status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE';
    created_at: string;
    updated_at: string;
    created_by: number | null;
    created_by_name: string;
}

interface EligibleDelegate {
    id: number;
    username: string;
    name: string;
    email: string;
    department: string;
    company?: string;
    company_code?: string;
}

export const LeaveDelegationPage: React.FC = () => {
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<'given' | 'received'>('given');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Form inputs
    const [delegateUserId, setDelegateUserId] = useState<number | ''>('');
    const [selectedDelegate, setSelectedDelegate] = useState<EligibleDelegate | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('Cuti Tahunan');
    const [scope, setScope] = useState<'ALL' | 'SPECIFIC_MODULE'>('ALL');
    const [selectedModules, setSelectedModules] = useState<string[]>(['EORDER', 'PR_NON_TRADE']);
    const [notifyDelegate, setNotifyDelegate] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Query list delegations
    const { data: delegations = [], isLoading } = useQuery<LeaveDelegation[]>({
        queryKey: ['leave-delegations', activeTab],
        queryFn: async () => {
            const res: any = await api.get('/settings/leave-delegations/', {
                params: { tab: activeTab }
            });
            return res.results || res;
        }
    });

    // Query current user's active status
    const { data: currentStatusData } = useQuery<{
        is_on_leave: boolean;
        active_delegation: LeaveDelegation | null;
        active_received_count: number;
    }>({
        queryKey: ['leave-delegation-status'],
        queryFn: async () => {
            const res: any = await api.get('/settings/leave-delegations/current-status/');
            return res;
        }
    });

    // Query eligible delegates (filtered to user's company and search query)
    const { data: eligibleDelegates = [], isLoading: isLoadingDelegates } = useQuery<EligibleDelegate[]>({
        queryKey: ['eligible-delegates', debouncedSearch],
        queryFn: async () => {
            const res: any = await api.get('/settings/leave-delegations/eligible-delegates/', {
                params: debouncedSearch ? { search: debouncedSearch } : {}
            });
            return Array.isArray(res) ? res : res.results || [];
        },
        enabled: isModalOpen && debouncedSearch.length > 0
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            return await api.post('/settings/leave-delegations/', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leave-delegations'] });
            queryClient.invalidateQueries({ queryKey: ['leave-delegation-status'] });
            closeModal();
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.delegate_user ||
                err?.response?.data?.end_date ||
                err?.response?.data?.detail ||
                (typeof err === 'string' ? err : 'Gagal menyimpan konfigurasi delegasi cuti.');
            setErrorMsg(Array.isArray(msg) ? msg[0] : String(msg));
        }
    });

    const toggleActiveMutation = useMutation({
        mutationFn: async (id: number) => {
            return await api.post(`/settings/leave-delegations/${id}/toggle-active/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leave-delegations'] });
            queryClient.invalidateQueries({ queryKey: ['leave-delegation-status'] });
        }
    });

    const endEarlyMutation = useMutation({
        mutationFn: async (id: number) => {
            return await api.post(`/settings/leave-delegations/${id}/end-early/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leave-delegations'] });
            queryClient.invalidateQueries({ queryKey: ['leave-delegation-status'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return await api.delete(`/settings/leave-delegations/${id}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leave-delegations'] });
            queryClient.invalidateQueries({ queryKey: ['leave-delegation-status'] });
            setDeletingId(null);
        }
    });

    const openCreateModal = () => {
        setDelegateUserId('');
        setSelectedDelegate(null);
        setSearchQuery('');
        setDebouncedSearch('');
        // Format current date: today to 5 days later
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5);

        const formatDateOnly = (d: Date) => {
            const pad = (n: number) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };

        setStartDate(formatDateOnly(start));
        setEndDate(formatDateOnly(end));
        setReason('Cuti Tahunan');
        setScope('ALL');
        setSelectedModules(['EORDER', 'PR_NON_TRADE']);
        setNotifyDelegate(true);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedDelegate(null);
        setSearchQuery('');
        setDebouncedSearch('');
        setErrorMsg('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!delegateUserId) {
            setErrorMsg('Please search and select a substitute delegate colleague from your company.');
            return;
        }

        if (!startDate || !endDate) {
            setErrorMsg('Start date and end date are required.');
            return;
        }

        if (startDate > endDate) {
            setErrorMsg('End date cannot be earlier than start date.');
            return;
        }

        createMutation.mutate({
            delegate_user: delegateUserId,
            start_date: startDate,
            end_date: endDate,
            reason: reason.trim(),
            scope,
            specific_module_codes: scope === 'SPECIFIC_MODULE' ? selectedModules : [],
            notify_delegate: notifyDelegate,
            is_active: true
        });
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getStatusBadge = (status: LeaveDelegation['current_status']) => {
        switch (status) {
            case 'ACTIVE':
                return (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={13} /> Active
                    </Badge>
                );
            case 'SCHEDULED':
                return (
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 font-semibold">
                        <Clock size={13} /> Scheduled
                    </Badge>
                );
            case 'EXPIRED':
                return (
                    <Badge className="bg-slate-100 text-slate-500 border-slate-200 flex items-center gap-1">
                        Expired
                    </Badge>
                );
            case 'INACTIVE':
            default:
                return (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                        <XCircle size={13} /> Inactive
                    </Badge>
                );
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <CalendarOff className="text-blue-600" size={26} />
                        Leave Approval Delegation
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Set temporary approval authority to colleagues when you are on annual leave, sick leave, or business trip.
                    </p>
                </div>
                <Button onClick={openCreateModal} className="flex items-center gap-2 shadow-xs shrink-0">
                    <Plus size={18} />
                    Set New Leave Approval Delegation
                </Button>
            </div>

            {/* Current Active Status Banner */}
            {currentStatusData?.is_on_leave && currentStatusData.active_delegation && (
                <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-300 rounded-2xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                        <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5 md:mt-0">
                            <UserCheck size={24} />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                                    ACTIVE LEAVE STATUS
                                </span>
                                <span className="text-xs text-slate-500 font-medium">
                                    {currentStatusData.active_delegation.reason}
                                </span>
                            </div>
                            <p className="text-sm font-semibold text-slate-900">
                                Your approval authority is currently delegated to{' '}
                                <strong className="text-emerald-700 underline underline-offset-2">
                                    {currentStatusData.active_delegation.delegate_user_name}
                                </strong>{' '}
                                ({currentStatusData.active_delegation.delegate_user_department})
                            </p>
                            <p className="text-xs text-slate-600 flex items-center gap-1.5">
                                <Calendar size={13} className="text-slate-400" />
                                Period: {formatDate(currentStatusData.active_delegation.start_date)} {currentStatusData.active_delegation.start_date !== currentStatusData.active_delegation.end_date ? `s/d ${formatDate(currentStatusData.active_delegation.end_date)}` : '(1 hari)'}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => endEarlyMutation.mutate(currentStatusData.active_delegation!.id)}
                        disabled={endEarlyMutation.isPending}
                        className="bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold shrink-0"
                    >
                        {endEarlyMutation.isPending ? 'Processing...' : 'I am already back at work (End Leave Early)'}
                    </Button>
                </div>
            )}

            {/* Tabs & Table Card */}
            <Card className="bg-white border border-slate-200/80 shadow-xs rounded-xl overflow-hidden">
                <div className="border-b border-slate-100 flex items-center justify-between px-4 bg-slate-50/50">
                    <div className="flex space-x-1">
                        <button
                            onClick={() => setActiveTab('given')}
                            className={`px-5 py-3.5 text-xs font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'given'
                                ? 'text-blue-600 border-blue-600 bg-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-700 border-transparent'
                                }`}
                        >
                            <Users size={16} />
                            Delegation Given
                        </button>
                        <button
                            onClick={() => setActiveTab('received')}
                            className={`px-5 py-3.5 text-xs font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'received'
                                ? 'text-blue-600 border-blue-600 bg-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-700 border-transparent'
                                }`}
                        >
                            <ShieldCheck size={16} />
                            Delegation Received
                            {currentStatusData && currentStatusData.active_received_count > 0 && (
                                <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">
                                    {currentStatusData.active_received_count}
                                </Badge>
                            )}
                        </button>
                    </div>
                    <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                        Total: {delegations.length} Delegation
                    </span>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 animate-pulse">
                        Loading data...
                    </div>
                ) : delegations.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <CalendarOff className="mx-auto mb-3 text-slate-300" size={40} />
                        <p className="font-semibold text-slate-700">No Leave Delegation Schedule</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {activeTab === 'given'
                                ? 'Click Button "Set New Leave Approval Delegation" to appoint a substitute colleague for approval.'
                                : 'No colleagues have delegated approval authority to you.'}
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-slate-50/80">
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>{activeTab === 'given' ? 'Delegate' : 'Original (Leave)'}</TableHead>
                                <TableHead>Time Period</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Authority Scope</TableHead>
                                {activeTab === 'given' && <TableHead className="text-right">Action</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {delegations.map((item, index) => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="font-medium text-slate-400 text-xs">
                                        {index + 1}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(item.current_status)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-0.5">
                                            <p className="font-semibold text-slate-800 text-sm">
                                                {activeTab === 'given' ? item.delegate_user_name : item.user_name}
                                            </p>
                                            <p className="text-xs text-slate-400 font-mono">
                                                {activeTab === 'given' ? item.delegate_user_email : item.user_email} • {activeTab === 'given' ? item.delegate_user_department : item.user_department}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs">
                                            {item.start_date === item.end_date ? (
                                                <div className="font-medium text-slate-700">
                                                    {formatDate(item.start_date)} <span className="text-slate-400 font-normal">(1 hari)</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                    <span>{formatDate(item.start_date)}</span>
                                                    <ArrowRight size={12} className="text-slate-400 shrink-0" />
                                                    <span>{formatDate(item.end_date)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs text-slate-700 font-medium">
                                            {item.reason || '-'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {item.scope === 'ALL' ? (
                                            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-200">
                                                All Approval (Global)
                                            </Badge>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {(item.specific_module_codes || []).map((m) => (
                                                    <Badge key={m} variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                                        {m}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </TableCell>
                                    {activeTab === 'given' && (
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {item.current_status === 'ACTIVE' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => endEarlyMutation.mutate(item.id)}
                                                        disabled={endEarlyMutation.isPending}
                                                        className="h-8 text-xs text-emerald-700 hover:bg-emerald-50 px-2"
                                                        title="End Leave Early"
                                                    >
                                                        End Now
                                                    </Button>
                                                )}

                                                <button
                                                    onClick={() => toggleActiveMutation.mutate(item.id)}
                                                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-xs"
                                                    title={item.is_active ? 'Deactivate' : 'Activate'}
                                                >
                                                    {item.is_active ? <XCircle size={16} className="text-amber-600" /> : <Check size={16} className="text-emerald-600" />}
                                                </button>

                                                {item.current_status !== 'ACTIVE' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDeletingId(item.id)}
                                                        className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            {/* Create Leave Delegation Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <CalendarOff className="text-blue-600" size={22} />
                                <h3 className="font-bold text-slate-800 text-lg">
                                    Set Leave Approval Delegation
                                </h3>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {errorMsg && (
                                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-2">
                                    <AlertCircle size={16} className="shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            {/* Info Callout */}
                            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
                                <p className="font-semibold flex items-center gap-1.5">
                                    <Info size={15} className="text-blue-600 shrink-0" /> Terms of Delegation:
                                </p>
                                <p className="text-slate-600 leading-relaxed text-[11px]">
                                    During the date range you specify, all requests addressed to you will be reviewed and approved by the substitute colleague you appoint. All actions are officially recorded in the audit history.
                                </p>
                            </div>

                            {/* Delegate User Selection via Search */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                    <span>
                                        Select Substitute Delegate <span className="text-red-500">*</span>
                                    </span>
                                    <span className="text-[11px] font-normal text-slate-400 lowercase">
                                        (same company)
                                    </span>
                                </label>

                                {selectedDelegate ? (
                                    <div className="flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                                {selectedDelegate.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-slate-800 truncate">
                                                        {selectedDelegate.name}
                                                    </p>
                                                    <span className="text-[11px] font-mono text-slate-400">
                                                        (@{selectedDelegate.username})
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                                                    <span>{selectedDelegate.department || 'No Dept'}</span>
                                                    {selectedDelegate.company && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="font-medium text-blue-700">{selectedDelegate.company}</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedDelegate(null);
                                                setDelegateUserId('');
                                            }}
                                            className="text-xs font-semibold border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 shrink-0 ml-2"
                                        >
                                            Change
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search colleague by name, username, or department..."
                                                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                                autoFocus
                                            />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchQuery('')}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Colleagues Result List - Hidden until user enters search */}
                                        {searchQuery.trim().length > 1 && (
                                            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-xs">
                                                {isLoadingDelegates || searchQuery.trim() !== debouncedSearch ? (
                                                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 p-4">
                                                        <Loader2 size={15} className="animate-spin text-blue-600" />
                                                        Searching colleagues in your company...
                                                    </div>
                                                ) : eligibleDelegates.length === 0 ? (
                                                    <div className="p-4 text-center text-xs text-slate-400">
                                                        No colleagues found matching "{debouncedSearch}" in your company.
                                                    </div>
                                                ) : (
                                                    eligibleDelegates.map((u) => (
                                                        <button
                                                            key={u.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedDelegate(u);
                                                                setDelegateUserId(u.id);
                                                                setErrorMsg('');
                                                            }}
                                                            className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/70 flex items-center justify-between gap-3 transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-blue-200 group-hover:text-blue-800 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                                                                    {u.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-700">
                                                                        {u.name} <span className="font-normal text-slate-400 font-mono text-[11px]">({u.username})</span>
                                                                    </p>
                                                                    <p className="text-[11px] text-slate-400 truncate">
                                                                        {u.department || 'No Dept'} {u.email ? `• ${u.email}` : ''}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {u.company && (
                                                                <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-600 border-slate-200 shrink-0">
                                                                    {u.company}
                                                                </Badge>
                                                            )}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Date Range: Start and End Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Start Date <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                        className="w-full text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        End Date <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                        className="w-full text-sm"
                                    />
                                </div>
                            </div>

                            {/* Reason for Leave */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g., Annual Leave, Business Trip"
                                    required
                                    className="w-full text-sm"
                                />
                            </div>

                            {/* Scope Selection */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Delegation Scope
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="scope"
                                            value="ALL"
                                            checked={scope === 'ALL'}
                                            onChange={() => setScope('ALL')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>All Requests (Global — Recommended)</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="scope"
                                            value="SPECIFIC_MODULE"
                                            checked={scope === 'SPECIFIC_MODULE'}
                                            onChange={() => setScope('SPECIFIC_MODULE')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>Specific Module Only</span>
                                    </label>
                                </div>
                            </div>

                            {scope === 'SPECIFIC_MODULE' && (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                                    <span className="font-semibold text-slate-700 block">Select Modules:</span>
                                    <div className="flex flex-wrap gap-4">
                                        {['EORDER', 'PR_NON_TRADE', 'FINANCE', 'HR'].map((mod) => (
                                            <label key={mod} className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedModules.includes(mod)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedModules([...selectedModules, mod]);
                                                        } else {
                                                            setSelectedModules(selectedModules.filter((m) => m !== mod));
                                                        }
                                                    }}
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="font-medium">{mod}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notify Delegate Checkbox */}
                            <div className="pt-2">
                                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={notifyDelegate}
                                        onChange={(e) => setNotifyDelegate(e.target.checked)}
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>Send confirmation email notification of the delegation to the appointed colleague</span>
                                </label>
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button type="button" variant="outline" onClick={closeModal}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Saving...' : 'Save Leave Schedule'}
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
                title="Delete Leave Delegation"
                description="Are you sure you want to delete this leave delegation?"
                confirmText="Delete"
                variant="danger"
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
};

