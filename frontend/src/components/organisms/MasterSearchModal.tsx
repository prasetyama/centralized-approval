import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    X,
    Loader2,
    Check,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';
import { MasterItem } from '../../services/prNonTradeService';

interface MasterSearchModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onSelect: (item: MasterItem) => void;
    fetchData: (searchQuery: string, page?: number, pageSize?: number) => Promise<{ count?: number; results?: MasterItem[] } | MasterItem[]>;
}

export const MasterSearchModal: React.FC<MasterSearchModalProps> = ({
    isOpen,
    title,
    onClose,
    onSelect,
    fetchData,
}) => {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [items, setItems] = useState<MasterItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    const fetchRef = useRef(fetchData);
    fetchRef.current = fetchData;

    // Reset state whenever modal is opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setDebouncedQuery('');
            setPage(1);
            setTotalCount(0);
            setItems([]);
            setError('');
        }
    }, [isOpen]);

    // Debounce search query
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, isOpen]);

    // Fetch data
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetchRef.current(debouncedQuery, page, pageSize);
                if (!isMounted) return;

                if (Array.isArray(res)) {
                    // Client-side array: paginate in-memory
                    setTotalCount(res.length);
                    const startIndex = (page - 1) * pageSize;
                    setItems(res.slice(startIndex, startIndex + pageSize));
                } else if (res && typeof res === 'object') {
                    // Server-side paginated response
                    const results = res.results || [];
                    const count = typeof res.count === 'number' ? res.count : results.length;
                    setTotalCount(count);
                    setItems(results);
                } else {
                    setItems([]);
                    setTotalCount(0);
                }

                if (listRef.current) {
                    listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } catch (err: any) {
                if (isMounted) setError('Failed to load master data.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        load();

        return () => {
            isMounted = false;
        };
    }, [isOpen, debouncedQuery, page, pageSize]);

    if (!isOpen) return null;

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = Math.min(safePage * pageSize, totalCount);

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (safePage > 3) pages.push('...');
            const start = Math.max(2, safePage - 1);
            const end = Math.min(totalPages - 1, safePage + 1);
            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
            }
            if (safePage < totalPages - 2) pages.push('...');
            if (!pages.includes(totalPages)) pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">{title}</h3>
                        <p className="text-xs text-blue-100">Search & select master data from the table</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
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
                            placeholder="Type code or name to search..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                            className="w-full pl-10 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold px-1 py-0.5 rounded cursor-pointer"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Items List / Table */}
                <div ref={listRef} className="flex-1 overflow-y-auto p-4 min-h-[280px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <Loader2 className="animate-spin text-blue-600" size={30} />
                            <span className="text-sm">Loading data...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <p className="text-sm font-medium">No data found</p>
                            <p className="text-xs text-slate-400 mt-1">Try using a different search keyword</p>
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
                                    <div className="flex flex-col pr-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                                {item.code}
                                            </span>
                                            {item.unit && (
                                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                                    Unit: {item.unit}
                                                </span>
                                            )}
                                            {item.sloc && (
                                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    SLOC: {item.sloc}
                                                </span>
                                            )}
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
                                    <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        <span>Select</span>
                                        <Check size={16} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer with Pagination */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-start">
                        <div className="flex items-center gap-1.5">
                            <span>Show:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-7 px-1.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                        <span className="text-slate-400">|</span>
                        <span>
                            Showing <strong className="font-semibold text-slate-800">{totalCount === 0 ? 0 : startIndex + 1}</strong> -{' '}
                            <strong className="font-semibold text-slate-800">{endIndex}</strong> of{' '}
                            <strong className="font-semibold text-slate-800">{totalCount.toLocaleString()}</strong>
                        </span>
                    </div>

                    <div className="flex items-center gap-1 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPage(1)}
                                disabled={safePage <= 1 || loading}
                                aria-label="First page"
                                title="First page"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronsLeft size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage(safePage - 1)}
                                disabled={safePage <= 1 || loading}
                                aria-label="Previous page"
                                title="Previous page"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={14} />
                            </button>

                            <div className="flex items-center gap-1">
                                {getPageNumbers().map((p, idx) => {
                                    if (p === '...') {
                                        return (
                                            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400 select-none">
                                                ...
                                            </span>
                                        );
                                    }
                                    const isCurrent = p === safePage;
                                    return (
                                        <button
                                            key={`page-${p}`}
                                            type="button"
                                            onClick={() => setPage(p as number)}
                                            disabled={loading}
                                            className={`inline-flex h-7 min-w-[28px] px-1.5 items-center justify-center rounded-md text-xs transition-all cursor-pointer ${
                                                isCurrent
                                                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={() => setPage(safePage + 1)}
                                disabled={safePage >= totalPages || loading}
                                aria-label="Next page"
                                title="Next page"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage(totalPages)}
                                disabled={safePage >= totalPages || loading}
                                aria-label="Last page"
                                title="Last page"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronsRight size={14} />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="ml-2 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
