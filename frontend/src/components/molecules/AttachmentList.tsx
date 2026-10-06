import React, { useState } from 'react';
import { FileText, Download, Eye, X, ExternalLink, Image as ImageIcon, Paperclip } from 'lucide-react';
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
}

interface AttachmentListProps {
    attachments: AttachmentItem[];
    title?: string;
    compact?: boolean;
}

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
    attachments,
    title = 'Lampiran',
    compact = false,
}) => {
    const [previewFile, setPreviewFile] = useState<AttachmentItem | null>(null);

    if (!attachments || attachments.length === 0) return null;

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
                    <div className="flex items-center gap-2">
                        <Paperclip size={18} className="text-slate-500" />
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                            {title} ({attachments.length})
                        </h3>
                    </div>
                )}

                <div className={compact ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 gap-3"}>
                    {attachments.map((file) => (
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
                    ))}
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
