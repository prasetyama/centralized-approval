import { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { cn } from '@/lib/utils';

interface ActionButtonsProps {
    requestId?: number;
    onApprove: (comments: string, dlvdate?: string) => Promise<void>;
    onReject: (comments: string) => Promise<void>;
    isLoading: boolean;
    canAction: boolean;
    isWatcher?: boolean;
    showDlvDateForm?: boolean;
}

export const ActionButtons = ({ onApprove, onReject, isLoading, canAction, isWatcher, showDlvDateForm }: ActionButtonsProps) => {
    const [showModal, setShowModal] = useState<'APPROVE' | 'REJECT' | null>(null);
    const [comments, setComments] = useState('');
    const [dlvdate, setDlvdate] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [dlvDateError, setDlvDateError] = useState<string | null>(null);

    const handleAction = async () => {
        if (!showModal) return;

        if (!comments.trim()) {
            setError('Comments are required');
            return;
        }

        if (showModal === 'APPROVE' && showDlvDateForm && !dlvdate.trim()) {
            setDlvDateError('Delivery Date is required for urgent orders');
            return;
        }

        try {
            setError(null);
            setDlvDateError(null);
            if (showModal === 'APPROVE') await onApprove(comments, showDlvDateForm ? dlvdate : undefined);
            if (showModal === 'REJECT') await onReject(comments);
            setShowModal(null);
            setComments('');
            setDlvdate('');
        } catch (error) {
            console.error('Action failed:', error);
        }
    };

    if (!canAction || isWatcher) return null;

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

                            {showModal === 'APPROVE' && showDlvDateForm && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            Delivery Date (Tanggal Pengiriman) <span className="text-red-500">*</span>
                                        </label>
                                        {dlvDateError && <span className="text-[10px] font-bold text-red-500 uppercase animate-pulse">{dlvDateError}</span>}
                                    </div>
                                    <input
                                        type="date"
                                        className={cn(
                                            "w-full rounded-xl border p-3 text-sm transition-all focus:outline-none focus:ring-4",
                                            dlvDateError
                                                ? "border-red-200 bg-red-50/30 focus:ring-red-100"
                                                : "border-slate-200 bg-slate-50 focus:bg-white focus:ring-blue-100"
                                        )}
                                        value={dlvdate}
                                        onChange={(e) => {
                                            setDlvdate(e.target.value);
                                            if (e.target.value.trim()) setDlvDateError(null);
                                        }}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comments</label>
                                    {error && <span className="text-[10px] font-bold text-red-500 uppercase animate-pulse">{error}</span>}
                                </div>
                                <textarea
                                    className={cn(
                                        "w-full min-h-[120px] rounded-xl border p-4 text-sm transition-all placeholder:text-slate-400 focus:outline-none focus:ring-4",
                                        error
                                            ? "border-red-200 bg-red-50/30 focus:bg-white focus:ring-red-100 placeholder:text-red-300"
                                            : "border-slate-200 bg-slate-50 focus:bg-white focus:ring-blue-100"
                                    )}
                                    placeholder="Type your feedback here..."
                                    value={comments}
                                    onChange={(e) => {
                                        setComments(e.target.value);
                                        if (e.target.value.trim()) setError(null);
                                    }}
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowModal(null);
                                        setError(null);
                                        setDlvDateError(null);
                                    }}
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
