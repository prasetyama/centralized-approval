import { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Paperclip, UploadCloud, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { cn } from '@/lib/utils';

interface QuotationFile {
    name: string;
    size: number;
    type: string;
    data: string;
}

interface ActionButtonsProps {
    requestId?: number;
    onApprove: (comments: string, dlvdate?: string, step_data?: Record<string, any>) => Promise<void>;
    onReject: (comments: string) => Promise<void>;
    isLoading: boolean;
    canAction: boolean;
    isWatcher?: boolean;
    showDlvDateForm?: boolean;
    requiredInputs?: any[];
    approverType?: string;
    isDeptHeadStep?: boolean;
}

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const ActionButtons = ({
    onApprove,
    onReject,
    isLoading,
    canAction,
    isWatcher,
    showDlvDateForm,
    requiredInputs,
    approverType,
    isDeptHeadStep,
}: ActionButtonsProps) => {
    const [showModal, setShowModal] = useState<'APPROVE' | 'REJECT' | null>(null);
    const [comments, setComments] = useState('');
    const [dlvdate, setDlvdate] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [quotationFiles, setQuotationFiles] = useState<QuotationFile[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [dlvDateError, setDlvDateError] = useState<string | null>(null);
    const [poError, setPoError] = useState<string | null>(null);
    const [quotationError, setQuotationError] = useState<string | null>(null);

    const isPurchasingStep = approverType === 'PURCH_DEPT_HEAD';
    const isDeptHead = isDeptHeadStep || requiredInputs?.length === 0;

    // 1. Hilangkan requiredinput requiresPo pada step purchasing
    const requiresPo = !isPurchasingStep && !isDeptHead && requiredInputs?.some((i: any) => (typeof i === 'string' ? i : i.key) === 'po_number');

    // 2. Ketika sampe step purchasing head / dept head, tidak perlu lagi membaca required inputs
    const requiresQuotation = !isDeptHead && requiredInputs?.some((i: any) => (typeof i === 'string' ? i : i.key) === 'quotation');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const filesArray = Array.from(e.target.files);

        filesArray.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64Data = event.target?.result as string;
                setQuotationFiles((prev) => [
                    ...prev,
                    {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        data: base64Data,
                    }
                ]);
            };
            reader.readAsDataURL(file);
        });

        if (quotationError) setQuotationError(null);
    };

    const handleRemoveFile = (indexToRemove: number) => {
        setQuotationFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleAction = async () => {
        if (!showModal) return;

        let hasError = false;

        if (showModal === 'APPROVE' && showDlvDateForm && !dlvdate.trim()) {
            setDlvDateError('Delivery Date is required for urgent orders');
            hasError = true;
        }

        if (showModal === 'APPROVE') {
            if (requiresPo && !poNumber.trim()) {
                setPoError('PO Number wajib diisi');
                hasError = true;
            }
            if (requiresQuotation && quotationFiles.length === 0) {
                setQuotationError('Lampiran file penawaran / quotation wajib diunggah (minimal 1 file)');
                hasError = true;
            }
        }

        if (hasError) return;

        try {
            setError(null);
            setDlvDateError(null);
            setPoError(null);
            setQuotationError(null);

            const stepData: Record<string, any> = {};
            if (requiresPo && poNumber.trim()) stepData.po_number = poNumber.trim();
            if (requiresQuotation && quotationFiles.length > 0) stepData.quotation = quotationFiles;

            if (showModal === 'APPROVE') {
                await onApprove(
                    comments, 
                    showDlvDateForm ? dlvdate : undefined, 
                    Object.keys(stepData).length > 0 ? stepData : undefined
                );
            }
            if (showModal === 'REJECT') await onReject(comments);
            setShowModal(null);
            setComments('');
            setDlvdate('');
            setPoNumber('');
            setQuotationFiles([]);
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
                                You are about to {showModal.toLowerCase()} this request. Please provide any required information or comments.
                            </p>

                            {showModal === 'APPROVE' && requiresPo && (
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            PO Number <span className="text-red-500">*</span>
                                        </label>
                                        {poError && <span className="text-[10px] font-bold text-red-500 uppercase">{poError}</span>}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Contoh: PO-2026/09/00142"
                                        className={cn(
                                            "w-full rounded-xl border p-3 text-sm transition-all focus:outline-none focus:ring-4",
                                            poError ? "border-red-300 bg-red-50/30" : "border-slate-200 bg-slate-50 focus:bg-white"
                                        )}
                                        value={poNumber}
                                        onChange={(e) => {
                                            setPoNumber(e.target.value);
                                            if (e.target.value.trim()) setPoError(null);
                                        }}
                                    />
                                </div>
                            )}

                            {showModal === 'APPROVE' && requiresQuotation && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                            <Paperclip size={14} className="text-indigo-600" />
                                            Attachment Quotation / Penawaran <span className="text-red-500">*</span>
                                        </label>
                                        {quotationError && <span className="text-[10px] font-bold text-red-500 uppercase">{quotationError}</span>}
                                    </div>

                                    {/* Upload Trigger Area */}
                                    <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all">
                                        <UploadCloud size={28} className="text-indigo-500 mb-1" />
                                        <span className="text-xs font-semibold text-slate-700">Klik untuk mengunggah file penawaran</span>
                                        <span className="text-[11px] text-slate-400 mt-0.5">Bisa milih lebih dari 1 file (PDF, Image, Doc, etc)</span>
                                        <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                    </label>

                                    {/* Attached Files List */}
                                    {quotationFiles.length > 0 && (
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                                            {quotationFiles.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-100/70 border border-slate-200 text-xs">
                                                    <div className="flex items-center gap-2 truncate pr-2">
                                                        <FileText size={16} className="text-indigo-600 shrink-0" />
                                                        <span className="font-medium text-slate-800 truncate">{file.name}</span>
                                                        <span className="text-[10px] text-slate-400 shrink-0">({formatFileSize(file.size)})</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFile(idx)}
                                                        className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-slate-200"
                                                        title="Hapus file"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

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
                                        setPoError(null);
                                        setQuotationError(null);
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
