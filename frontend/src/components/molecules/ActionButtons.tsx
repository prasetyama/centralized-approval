import { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { cn } from '@/lib/utils';

interface ActionButtonsProps {
    requestId: number;
    onApprove: (comments: string) => Promise<void>;
    onReject: (comments: string) => Promise<void>;
    isLoading: boolean;
    canAction: boolean;
}

export const ActionButtons = ({ onApprove, onReject, isLoading, canAction }: Omit<ActionButtonsProps, 'requestId'>) => {
    const [showModal, setShowModal] = useState<'APPROVE' | 'REJECT' | null>(null);
    const [comments, setComments] = useState('');

    const handleAction = async () => {
        if (!showModal) return;

        try {
            if (showModal === 'APPROVE') await onApprove(comments);
            if (showModal === 'REJECT') await onReject(comments);
            setShowModal(null);
            setComments('');
        } catch (error) {
            console.error('Action failed:', error);
        }
    };

    if (!canAction) return null;

    return (
        <div className="flex gap-4">
            <Button
                variant="primary"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                onClick={() => setShowModal('APPROVE')}
                loading={isLoading}
            >
                <CheckCircle2 size={18} className="mr-2" /> Approve
            </Button>
            <Button
                variant="danger"
                className="flex-1"
                onClick={() => setShowModal('REJECT')}
                loading={isLoading}
            >
                <XCircle size={18} className="mr-2" /> Reject
            </Button>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    showModal === 'APPROVE' ? "bg-emerald-50 text-emerald-600" :
                                        showModal === 'REJECT' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                                )}>
                                    {showModal === 'APPROVE' ? <CheckCircle2 size={24} /> :
                                        showModal === 'REJECT' ? <XCircle size={24} /> : <AlertTriangle size={24} />}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">
                                    {showModal === 'APPROVE' ? 'Approve Request' :
                                        showModal === 'REJECT' ? 'Reject Request' : 'Request Revision'}
                                </h3>
                            </div>

                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                You are about to {showModal.toLowerCase()} this request. Please provide any comments or feedback for the requester.
                            </p>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comments</label>
                                <textarea
                                    className="w-full min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                                    placeholder="Type your feedback here..."
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setShowModal(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant={showModal === 'APPROVE' ? 'primary' : showModal === 'REJECT' ? 'danger' : 'outline'}
                                    className={cn(
                                        "flex-1",
                                        showModal === 'APPROVE' && "bg-emerald-600 hover:bg-emerald-700",
                                    )}
                                    onClick={handleAction}
                                    loading={isLoading}
                                >
                                    Confirm {showModal.toLowerCase()}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
