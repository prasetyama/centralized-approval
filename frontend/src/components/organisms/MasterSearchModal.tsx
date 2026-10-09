import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, Check } from 'lucide-react';
import { MasterItem } from '../../services/prNonTradeService';

interface MasterSearchModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onSelect: (item: MasterItem) => void;
    fetchData: (searchQuery: string) => Promise<{ results?: MasterItem[] } | MasterItem[]>;
}

export const MasterSearchModal: React.FC<MasterSearchModalProps> = ({
    isOpen,
    title,
    onClose,
    onSelect,
    fetchData
}) => {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<MasterItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetchData(query);
                if (!isMounted) return;
                const data = Array.isArray(res) ? res : res.results || [];
                setItems(data);
            } catch (err: any) {
                if (isMounted) setError('Failed to load master data.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        const timer = setTimeout(load, 300);
        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [isOpen, query]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                    <div>
                        <h3 className="text-lg font-bold text-white">{title}</h3>
                        <p className="text-xs text-slate-300">Cari & pilih master data dari tabel</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-300 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Input Bar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Ketik kode atau nama untuk mencari..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Items List / Table */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                            <Loader2 className="animate-spin text-blue-600" size={28} />
                            <span className="text-sm">Memuat data...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-10 text-red-500 text-sm">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <p className="text-sm font-medium">Tidak ada data ditemukan</p>
                            <p className="text-xs text-slate-400 mt-1">Coba gunakan kata kunci pencarian yang lain</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        onSelect(item);
                                        onClose();
                                    }}
                                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer group"
                                >
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                                {item.code}
                                            </span>
                                            {item.category && (
                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                    {item.category}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-sm font-semibold text-slate-800 mt-1">
                                            {item.name || item.description}
                                        </span>
                                        {item.project_name && (
                                            <span className="text-xs text-slate-500 mt-0.5">
                                                Project: {item.project_name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span>Pilih</span>
                                        <Check size={16} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Batal
                    </button>
                </div>
            </div>
        </div>
    );
};
