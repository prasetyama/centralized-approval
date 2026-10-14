import React, { useState } from 'react';
import { FileText, Download, Eye, X, ExternalLink, Image as ImageIcon, Paperclip, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { formatFileSize } from '@/lib/utils';

export interface AttachmentItem {
    id: string;
    name: string;
    size?: number;
    type?: string;
    data?: string;
    url?: string;
    source?: string; // e.g. "Purchasing Step", "Payload"
    uploaderName?: string;
    raw?: any;
}

interface AttachmentListProps {
    attachments: AttachmentItem[];
    title?: string;
    selectedQuotation?: any;
    compact?: boolean;
}

export const isQuotationSelected = (file: AttachmentItem, selectedQuotation?: any): boolean => {
    if (!selectedQuotation || !file) return false;

    // Support wrapped object { quotation: ..., approvedBy: ... } or direct quotation
    const target = (selectedQuotation && typeof selectedQuotation === 'object' && selectedQuotation.quotation !== undefined)
        ? selectedQuotation.quotation
        : selectedQuotation;

    if (!target) return false;

    const selectedName = typeof target === 'string'
        ? target.trim()
        : (target.name || target.filename || target.quotation_name || target.title || '').trim();

    const selectedUrl = typeof target === 'object'
        ? (target.url || target.data || target.file_path)
        : (typeof target === 'string' && (target.startsWith('http') || target.startsWith('data:') || target.startsWith('/')) ? target : null);

    if (selectedName && file.name) {
        const cleanFileName = file.name.trim().toLowerCase();
        const cleanSelName = selectedName.toLowerCase();
        if (
            cleanFileName === cleanSelName ||
            cleanFileName.includes(cleanSelName) ||
            cleanSelName.includes(cleanFileName)
        ) {
            return true;
        }
    }

    if (selectedUrl && (file.url === selectedUrl || file.data === selectedUrl)) {
        return true;
    }

    if (typeof target === 'object' && target.id && (file.id === target.id || file.id === `att-${target.id}`)) {
        return true;
    }

    return false;
};

export const downloadFile = (file: { name: string; data?: string; url?: string; type?: string }) => {
    const fileUrl = file.data || file.url;
    if (!fileUrl) return;

    if (fileUrl.startsWith('data:')) {
        try {
            const parts = fileUrl.split(';base64,');
            const contentType = parts[0].replace('data:', '') || file.type || 'application/octet-stream';
            const raw = window.atob(parts[1]);
            const rawLength = raw.length;
            const uInt8Array = new Uint8Array(rawLength);
            for (let i = 0; i < rawLength; ++i) {
                uInt8Array[i] = raw.charCodeAt(i);
            }
            const blob = new Blob([uInt8Array], { type: contentType });
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = file.name || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (err) {
            console.error('Failed to download base64 file', err);
        }
    } else {
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = file.name || 'download';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

export const viewFile = (file: { name: string; data?: string; url?: string; type?: string }) => {
    const fileUrl = file.data || file.url;
    if (!fileUrl) return;

    if (fileUrl.startsWith('data:')) {
        try {
            const parts = fileUrl.split(';base64,');
            const contentType = parts[0].replace('data:', '') || file.type || 'application/octet-stream';
            const raw = window.atob(parts[1]);
            const rawLength = raw.length;
            const uInt8Array = new Uint8Array(rawLength);
            for (let i = 0; i < rawLength; ++i) {
                uInt8Array[i] = raw.charCodeAt(i);
            }
            const blob = new Blob([uInt8Array], { type: contentType });
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
        } catch (err) {
            console.error('Failed to view base64 file', err);
        }
    } else {
        window.open(fileUrl, '_blank');
    }
};

export const AttachmentList: React.FC<AttachmentListProps> = ({
    attachments = [],
    title = 'Lampiran',
    selectedQuotation,
    compact = false,
}) => {
    const [previewFile, setPreviewFile] = useState<AttachmentItem | null>(null);

    // Extract metadata if selectedQuotation has approval wrapper
    const selectedMeta = typeof selectedQuotation === 'object' && selectedQuotation !== null && selectedQuotation.quotation !== undefined
        ? selectedQuotation
        : null;

    console.log("selectedMeta", selectedMeta);

    const quotationTarget = selectedMeta ? selectedMeta.quotation : selectedQuotation;

    // Check if target is in attachments or if we need to synthesize an item
    const fileList = [...(attachments || [])];
    if (quotationTarget) {
        const hasMatch = fileList.some((f) => isQuotationSelected(f, selectedQuotation));
        if (!hasMatch) {
            const synthName = typeof quotationTarget === 'string'
                ? quotationTarget
                : (quotationTarget.name || quotationTarget.filename || 'Quotation Terpilih');
            const synthUrl = typeof quotationTarget === 'object' ? quotationTarget.url : (typeof quotationTarget === 'string' && !quotationTarget.startsWith('data:') ? quotationTarget : undefined);
            const synthData = typeof quotationTarget === 'object' ? quotationTarget.data : (typeof quotationTarget === 'string' && quotationTarget.startsWith('data:') ? quotationTarget : undefined);

            fileList.unshift({
                id: 'selected-quotation-synthetic',
                name: synthName,
                size: quotationTarget.size || 0,
                type: quotationTarget.type || 'application/pdf',
                url: synthUrl,
                data: synthData,
                source: selectedMeta?.stepName || 'Approval Step',
            });
        }
    }

    // Sort to ensure the selected quotation is placed at the top of the list
    const sortedAttachments = [...fileList].sort((a, b) => {
        const aSelected = isQuotationSelected(a, selectedQuotation);
        const bSelected = isQuotationSelected(b, selectedQuotation);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
    });

    if (sortedAttachments.length === 0) return null;

    const getFileIcon = (file: AttachmentItem) => {
        const type = (file.type || '').toLowerCase();
        const name = (file.name || '').toLowerCase();
        if (type.includes('image') || name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
            return <ImageIcon size={compact ? 16 : 20} className="text-purple-600 shrink-0" />;
        }
        return <FileText size={compact ? 16 : 20} className="text-indigo-600 shrink-0" />;
    };

    const isImage = (file: AttachmentItem) => {
        const type = (file.type || '').toLowerCase();
        const name = (file.name || '').toLowerCase();
        const data = (file.data || '').toLowerCase();
        return (
            type.includes('image') ||
            data.startsWith('data:image/') ||
            name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)
        );
    };

    const isPdf = (file: AttachmentItem) => {
        const type = (file.type || '').toLowerCase();
        const name = (file.name || '').toLowerCase();
        const data = (file.data || '').toLowerCase();
        return (
            type.includes('pdf') ||
            data.startsWith('data:application/pdf') ||
            name.endsWith('.pdf')
        );
    };

    const handlePreview = (file: AttachmentItem) => {
        setPreviewFile(file);
    };

    return (
        <>
            <div className="space-y-3">
                {title && !compact && (
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Paperclip size={18} className="text-slate-500" />
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                                {title} ({sortedAttachments.length})
                            </h3>
                        </div>
                    </div>
                )}

                <div className={compact ? "space-y-2" : "grid grid-cols-2 gap-3"}>
                    {sortedAttachments.map((file) => {
                        const isSelected = isQuotationSelected(file, selectedQuotation);

                        if (isSelected) {
                            return (
                                <div
                                    key={file.id}
                                    className={`relative flex items-center justify-between p-3.5 rounded-xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50/90 via-emerald-50/30 to-white shadow-sm ring-2 ring-emerald-500/10 transition-all py-2 px-3 text-xs`}
                                >
                                    <div className="flex items-center gap-3.5 truncate pr-2 min-w-0">
                                        <div className="relative shrink-0">
                                            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                                                {getFileIcon(file)}
                                            </div>
                                            <div className="absolute -top-1 -right-1.5 bg-emerald-600 text-white rounded-full p-0.5 shadow-xs">
                                                <CheckCircle2 size={11} className="stroke-[3]" />
                                            </div>
                                        </div>
                                        <div className="truncate min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-slate-900 text-xs truncate" title={file.name}>
                                                    {file.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                                                {file.size ? <span>{formatFileSize(file.size)}</span> : null}
                                                {file.source ? (
                                                    <span className="bg-emerald-100/80 px-1.5 py-0.5 rounded font-medium text-emerald-800">
                                                        {file.source}
                                                    </span>
                                                ) : null}
                                                {selectedMeta?.approvedBy && (
                                                    <span className="text-emerald-700 font-medium">
                                                        • Disetujui oleh {selectedMeta.approvedBy}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handlePreview(file)}
                                            className="h-8 px-2.5 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 font-bold rounded-lg"
                                            title="Lihat File"
                                        >
                                            <Eye size={14} className="mr-1" />
                                            Lihat
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="sm"
                                            onClick={() => downloadFile(file)}
                                            className="h-8 px-2.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 font-bold rounded-lg shadow-xs"
                                            title="Unduh File"
                                        >
                                            <Download size={14} className="mr-1" />
                                            Unduh
                                        </Button>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={file.id}
                                className={`flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 transition-all ${compact ? "py-2 px-3 text-xs" : ""
                                    }`}
                            >
                                <div className="flex items-center gap-3 truncate pr-2 min-w-0">
                                    {getFileIcon(file)}
                                    <div className="truncate min-w-0">
                                        <p className="font-semibold text-slate-900 text-xs truncate" title={file.name}>
                                            {file.name}
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                            {file.size ? <span>{formatFileSize(file.size)}</span> : null}
                                            {file.source ? (
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-600">
                                                    {file.source}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handlePreview(file)}
                                        className="h-8 px-2.5 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold rounded-lg"
                                        title="Lihat File"
                                    >
                                        <Eye size={14} className="mr-1" />
                                        Lihat
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => downloadFile(file)}
                                        className="h-8 px-2.5 text-xs text-slate-700 hover:bg-slate-100 font-bold rounded-lg border-slate-200"
                                        title="Unduh File"
                                    >
                                        <Download size={14} className="mr-1" />
                                        Unduh
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
                            <div className="flex items-center gap-3 truncate pr-4">
                                {getFileIcon(previewFile)}
                                <div className="truncate">
                                    <h4 className="font-bold text-slate-900 text-sm truncate">{previewFile.name}</h4>
                                    <p className="text-xs text-slate-500">
                                        {previewFile.size ? formatFileSize(previewFile.size) : 'File attachment'}
                                        {previewFile.source ? ` • ${previewFile.source}` : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => viewFile(previewFile)}
                                    className="text-xs font-bold gap-1 rounded-xl"
                                >
                                    <ExternalLink size={14} />
                                    Tab Baru
                                </Button>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => downloadFile(previewFile)}
                                    className="text-xs font-bold gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                                >

                                    <Download size={14} />
                                    Unduh
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setPreviewFile(null)}
                                    className="rounded-full text-slate-400 hover:text-slate-700"
                                >
                                    <X size={20} />
                                </Button>
                            </div>
                        </div>

                        {/* Content Body */}
                        <div className="flex-1 p-6 overflow-auto bg-slate-100/50 flex items-center justify-center min-h-[400px]">
                            {isImage(previewFile) ? (
                                <img
                                    src={previewFile.data || previewFile.url}
                                    alt={previewFile.name}
                                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
                                />
                            ) : isPdf(previewFile) ? (
                                <iframe
                                    src={previewFile.data || previewFile.url}
                                    title={previewFile.name}
                                    className="w-full h-[70vh] rounded-lg border border-slate-200"
                                />
                            ) : (
                                <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md space-y-4">
                                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                                        <FileText size={32} />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-slate-900 text-base mb-1">{previewFile.name}</h5>
                                        <p className="text-xs text-slate-500">
                                            Preview langsung tidak tersedia untuk jenis file ini. Silakan buka di tab baru atau unduh file.
                                        </p>
                                    </div>
                                    <div className="flex justify-center gap-3 pt-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => viewFile(previewFile)}
                                            className="font-bold text-xs"
                                        >
                                            <ExternalLink size={14} className="mr-1.5" />
                                            Buka Tab Baru
                                        </Button>
                                        <Button
                                            onClick={() => downloadFile(previewFile)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                                        >
                                            <Download size={14} className="mr-1.5" />
                                            Unduh File
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
