import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Select } from '@/components/atoms/Select';
import { Textarea } from '@/components/atoms/Textarea';

interface DelegateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (newAssigneeId: number, comments: string) => Promise<void>;
    roleRequiredId: number;
    roleName: string;
    isLoading?: boolean;
}

export const DelegateModal = ({
    isOpen,
    onClose,
    onSubmit,
    roleRequiredId,
    roleName,
    isLoading: isSubmitting
}: DelegateModalProps) => {
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [comments, setComments] = useState('');

    const { data: usersData, isLoading: isLoadingUsers } = useQuery({
        queryKey: ['users-by-role', roleRequiredId],
        queryFn: async () => {
            const response: any = await api.get('/admin/users', {
                params: { role: roleRequiredId, is_active: true, is_approver: true }
            });
            return response;
        },
        enabled: isOpen && !!roleRequiredId,
    });

    const handleConfirm = async () => {
        if (!selectedUserId) return;
        await onSubmit(Number(selectedUserId), comments);
        onClose();
        setSelectedUserId('');
        setComments('');
    };

    if (!isOpen) return null;

    const users = (usersData as any) || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <Card className="w-full max-w-lg shadow-2xl border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 bg-white">
                <div className="p-1 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                <div className="p-8 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 ring-4 ring-blue-50/50">
                            <User size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Delegate Approval</h3>
                            <p className="text-sm text-slate-500 font-medium">Reassign this task to another authorized user.</p>
                        </div>
                    </div>

                    <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-4 flex gap-3">
                        <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 font-medium leading-relaxed">
                            This step requires the <span className="font-bold underline">{roleName}</span> role.
                            Only users with this role are listed below.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <User size={14} /> New Assignee
                            </label>
                            {isLoadingUsers ? (
                                <div className="flex items-center gap-2 text-sm text-slate-400 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <Loader2 size={16} className="animate-spin" />
                                    Loading authorized users...
                                </div>
                            ) : users.results.length === 0 ? (
                                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
                                    No active users found with the required role.
                                </div>
                            ) : (
                                <Select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    options={[
                                        { value: '', label: 'Select a new approver...' },
                                        ...users.results.map((u: any) => ({
                                            value: u.id.toString(),
                                            label: `${u.first_name} ${u.last_name} (@${u.username})`
                                        }))
                                    ]}
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare size={14} /> Delegation Notes
                            </label>
                            <Textarea
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                placeholder="E.g., Reassigning due to leave of absence..."
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button
                            variant="ghost"
                            className="flex-1 rounded-xl h-12 font-bold text-slate-500 hover:bg-slate-100 transition-all"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            className="flex-1 rounded-xl h-12 font-bold shadow-lg shadow-blue-100 bg-blue-600 hover:bg-blue-700 transition-all"
                            onClick={handleConfirm}
                            loading={isSubmitting}
                            disabled={!selectedUserId || isLoadingUsers || users.length === 0}
                        >
                            Confirm Delegation
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
