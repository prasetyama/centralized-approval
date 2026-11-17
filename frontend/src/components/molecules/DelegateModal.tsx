import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, MessageSquare, Loader2, Search, ArrowRightLeft, CheckCircle2, X } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Textarea } from '@/components/atoms/Textarea';
import { cn } from '@/lib/utils';

interface DelegateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (newAssigneeId: number, comments: string) => Promise<void>;
    roleName?: string;
    stepName?: string;
    stepOrder?: number;
    currentApproverName?: string;
    currentApproverEmail?: string;
    isLoading?: boolean;
}

export const DelegateModal = ({
    isOpen,
    onClose,
    onSubmit,
    roleName,
    stepName,
    stepOrder,
    currentApproverName,
    currentApproverEmail,
    isLoading: isSubmitting
}: DelegateModalProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [comments, setComments] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setDebouncedQuery('');
            setSelectedUser(null);
            setComments('');
            setError(null);
            return;
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const { data: usersData, isLoading: isLoadingUsers } = useQuery({
        queryKey: ['redirect-approver-users', debouncedQuery],
        queryFn: async () => {
            const response: any = await api.get('/admin/users', {
                params: {
                    search: debouncedQuery,
                    is_active: true,
                    page_size: 20,
                }
            });
            return response;
        },
        enabled: isOpen && debouncedQuery.length >= 2 && !selectedUser,
    });

    const handleConfirm = async () => {
        if (!selectedUser) {
            setError('Please select a replacement approver.');
            return;
        }

        if (!comments.trim()) {
            setError('Redirect reason is required.');
            return;
        }

        setError(null);
        await onSubmit(Number(selectedUser.id), comments.trim());
        onClose();
    };

    if (!isOpen) return null;

    const rawUsers = Array.isArray((usersData as any)?.results)
        ? (usersData as any).results
        : Array.isArray(usersData)
            ? (usersData as any)
            : [];

    const candidateUsers = rawUsers.filter((u: any) => {
        if (currentApproverEmail && u.email && u.email.toLowerCase() === currentApproverEmail.toLowerCase()) {
            return false;
        }
        return true;
    });

    const getUserFullName = (u: any) => {
        const full = `${u.first_name || ''} ${u.last_name || ''}`.trim();
        return full || u.username || u.email || 'Unknown User';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-lg shadow-2xl border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 bg-white">
                <div className="p-1 h-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
                <div className="p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-purple-50 text-purple-600 ring-4 ring-purple-50/50">
                                <ArrowRightLeft size={26} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Redirect Active Approval</h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Reassign the current waiting step to another approver (Admin Only).
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Active Step & Current Approver Summary */}
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-400 uppercase tracking-wider">Active Step</span>
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                                {stepOrder ? `Step ${stepOrder}` : 'Current Step'}{stepName ? ` • ${stepName}` : ''}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/70">
                            <span className="font-bold text-slate-400 uppercase tracking-wider">Current Approver</span>
                            <span className="font-semibold text-slate-800">
                                {currentApproverName || roleName || 'Unassigned'}
                                {currentApproverEmail ? <span className="text-slate-400 font-normal"> ({currentApproverEmail})</span> : null}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Search & Select Replacement Approver */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                <User size={14} className="text-purple-600" />
                                New Approver (Replacement) <span className="text-red-500">*</span>
                            </label>

                            {selectedUser ? (
                                <div className="flex items-center justify-between p-3.5 rounded-xl border-2 border-purple-500 bg-purple-50/40">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-9 w-9 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                            {getUserFullName(selectedUser).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                                                {getUserFullName(selectedUser)}
                                                <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">
                                                {selectedUser.email || selectedUser.username}
                                                {selectedUser.department ? ` • ${selectedUser.department}` : ''}
                                                {selectedUser.company_code ? ` (${selectedUser.company_code})` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedUser(null)}
                                        className="text-xs font-bold text-purple-700 border-purple-200 hover:bg-purple-100 shrink-0"
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
                                            placeholder="Type name, username, or email (min. 2 chars)..."
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
                                            autoFocus
                                        />
                                    </div>

                                    {debouncedQuery.length > 0 && debouncedQuery.length < 2 && (
                                        <p className="text-xs text-slate-400 px-1">
                                            Please type at least 2 characters to search users.
                                        </p>
                                    )}

                                    {debouncedQuery.length >= 2 && (
                                        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-sm">
                                            {isLoadingUsers ? (
                                                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 p-4">
                                                    <Loader2 size={15} className="animate-spin text-purple-600" />
                                                    Searching users...
                                                </div>
                                            ) : candidateUsers.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-slate-400">
                                                    No matching active users found.
                                                </div>
                                            ) : (
                                                candidateUsers.map((u: any) => (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedUser(u);
                                                            if (error) setError(null);
                                                        }}
                                                        className="w-full text-left px-3.5 py-2.5 hover:bg-purple-50/60 flex items-center justify-between gap-3 transition-colors"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 truncate">
                                                                {getUserFullName(u)}
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 truncate">
                                                                {u.email || u.username}
                                                                {u.department ? ` • ${u.department}` : ''}
                                                            </p>
                                                        </div>
                                                        {u.company_code && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                                                {u.company_code}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Redirect Reason */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <MessageSquare size={14} className="text-purple-600" />
                                    Redirect Reason <span className="text-red-500">*</span>
                                </label>
                                {error && <span className="text-[10px] font-bold text-red-500 uppercase animate-pulse">{error}</span>}
                            </div>
                            <Textarea
                                value={comments}
                                onChange={(e) => {
                                    setComments(e.target.value);
                                    if (e.target.value.trim()) setError(null);
                                }}
                                placeholder="E.g., Approver is currently on leave / out of office..."
                                className={cn(
                                    "min-h-[90px] resize-none transition-all",
                                    error && "border-red-200 bg-red-50/30 focus:ring-red-100 placeholder:text-red-300"
                                )}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="ghost"
                            className="flex-1 rounded-xl h-11 font-bold text-slate-500 hover:bg-slate-100 transition-all"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            className="flex-1 rounded-xl h-11 font-bold shadow-lg shadow-purple-100 bg-purple-600 hover:bg-purple-700 transition-all"
                            onClick={handleConfirm}
                            loading={isSubmitting}
                            disabled={!selectedUser || isSubmitting}
                        >
                            Confirm Redirect
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
