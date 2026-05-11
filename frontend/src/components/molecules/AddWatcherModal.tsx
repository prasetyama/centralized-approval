import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Select } from '@/components/atoms/Select';

interface AddWatcherModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (userId: number) => Promise<void>;
    isLoading?: boolean;
}

export const AddWatcherModal = ({
    isOpen,
    onClose,
    onSubmit,
    isLoading: isSubmitting
}: AddWatcherModalProps) => {
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    const { data: usersData, isLoading: isLoadingUsers } = useQuery({
        queryKey: ['users-list'],
        queryFn: async () => {
            const response: any = await api.get('/admin/users', {
                params: { is_active: true }
            });
            return response;
        },
        enabled: isOpen,
    });

    const handleConfirm = async () => {
        if (!selectedUserId) return;
        await onSubmit(Number(selectedUserId));
        setSelectedUserId('');
    };

    if (!isOpen) return null;

    const users = (usersData as any)?.results || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <Card className="w-full max-w-lg shadow-2xl border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 bg-white">
                <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Add Watcher</h3>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Select User
                            </label>
                            {isLoadingUsers ? (
                                <div className="flex items-center gap-2 text-sm text-slate-400 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <Loader2 size={16} className="animate-spin" />
                                    Finding users...
                                </div>
                            ) : (
                                <Select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    options={[
                                        { value: '', label: 'Choose a user...' },
                                        ...users.map((u: any) => ({
                                            value: u.id.toString(),
                                            label: `${u.first_name} ${u.last_name} (${u.username})`
                                        }))
                                    ]}
                                />
                            )}
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
                            className="flex-1 rounded-xl h-12 font-bold shadow-lg shadow-indigo-100 bg-blue-600 hover:bg-indigo-700 transition-all"
                            onClick={handleConfirm}
                            loading={isSubmitting}
                            disabled={!selectedUserId || isLoadingUsers}
                        >
                            Add as Watcher
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
