import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, FileText, Search, Edit3, Eye, Trash2, Loader2
} from 'lucide-react';
import { prNonTradeService, PRNonTradeData } from '../services/prNonTradeService';
import { useToast } from '../context/ToastContext';

export const PRNonTradeListPage: React.FC = () => {
    const navigate = useNavigate();
    const toast = useToast();

    const [items, setItems] = useState<PRNonTradeData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await prNonTradeService.getList();
            const list = Array.isArray(res) ? res : res.results || [];
            setItems(list);
        } catch (err: any) {
            toast.error('Gagal memuat daftar PR Non-Trade.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDeleteDraft = async (id: number) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus draft ini?')) return;
        try {
            await prNonTradeService.deleteDraft(id);
            toast.success('Draft berhasil dihapus.');
            loadData();
        } catch (err: any) {
            toast.error('Gagal menghapus draft.');
        }
    };

    const filteredItems = items.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
            (item.transaction_id || '').toLowerCase().includes(q) ||
            (item.purpose || '').toLowerCase().includes(q) ||
            (item.requestor_name || '').toLowerCase().includes(q) ||
            (item.status || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6 font-poppins">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                        <FileText className="text-blue-600" size={26} />
                        Daftar PR Non-Trade
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Kelola dan ajukan Purchase Request Non-Trade dengan integrasi Centralized Approval Engine (Workflow ID: 10).
                    </p>
                </div>

                <button
                    onClick={() => navigate('/pr-non-trade/create')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer shrink-0"
                >
                    <Plus size={18} />
                    <span>Buat Pengajuan Baru</span>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari No Transaksi, Purpose, Requestor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors shadow-sm"
                    />
                </div>

                <div className="text-sm text-slate-600 font-medium">
                    Total: <span className="font-bold text-slate-900">{filteredItems.length}</span> pengajuan
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                        <Loader2 size={36} className="animate-spin text-blue-600" />
                        <span className="text-sm font-medium">Memuat daftar pengajuan...</span>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <FileText size={44} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-base font-semibold text-slate-700">Belum ada pengajuan PR Non-Trade</p>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                            Klik tombol "Buat Pengajuan Baru" di atas untuk mengisi form PR Non-Trade.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-700">
                            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="py-3.5 px-4">Transaction ID</th>
                                    <th className="py-3.5 px-4">Tanggal</th>
                                    <th className="py-3.5 px-4">Requestor</th>
                                    <th className="py-3.5 px-4">Purpose</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-center">Total Item</th>
                                    <th className="py-3.5 px-4 text-center w-28">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700 text-sm">
                                            {item.transaction_id || <span className="text-slate-400 italic font-normal">Draft (Belum diset)</span>}
                                        </td>
                                        <td className="py-3.5 px-4 text-slate-600 font-medium text-sm">
                                            {item.transaction_date || '-'}
                                        </td>
                                        <td className="py-3.5 px-4 font-semibold text-slate-800 text-sm">
                                            {item.requestor_name}
                                            <div className="text-xs font-normal text-slate-500 mt-0.5">
                                                {item.requester_department}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 font-medium text-sm">
                                            {item.purpose || '-'}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            {item.status === 'DRAFT' && (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                                    DRAFT
                                                </span>
                                            )}
                                            {item.status === 'SUBMITTED' && (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                                    SUBMITTED
                                                </span>
                                            )}
                                            {item.status === 'CANCELLED' && (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                    CANCELLED
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-center font-bold text-slate-800 text-sm">
                                            {item.items?.length || 0}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {item.status === 'DRAFT' ? (
                                                    <>
                                                        <button
                                                            onClick={() => navigate(`/pr-non-trade/${item.id}/edit`)}
                                                            className="p-2 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Edit Draft"
                                                        >
                                                            <Edit3 size={17} />
                                                        </button>
                                                        <button
                                                            onClick={() => item.id && handleDeleteDraft(item.id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Hapus Draft"
                                                        >
                                                            <Trash2 size={17} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => item.approval_request && navigate(`/workflow/${item.approval_request}`)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Lihat Detail Approval"
                                                    >
                                                        <Eye size={17} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
