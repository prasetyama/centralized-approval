import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Search, 
    X, 
    Loader2, 
    Hash, 
    User, 
    Calendar, 
    ChevronRight, 
    SearchX, 
    CornerDownLeft,
    Clock,
    FileText
} from 'lucide-react';
import api from '@/services/api';
import { Badge } from '@/components/atoms/Badge';
import { formatDate } from '@/lib/utils';

export interface ApprovalSearchItem {
    id: number;
    reference_id: string;
    module: number;
    module_name?: string;
    module_code?: string;
    module_color?: string;
    title: string;
    status: string;
    priority?: string;
    current_step?: number;
    current_step_name?: string;
    requester_name?: string;
    division_name?: string;
    created_at: string;
}

export const GlobalSearch = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState<ApprovalSearchItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const mobileInputRef = useRef<HTMLInputElement>(null);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Fetch search results from backend
    useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setResults([]);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        const fetchResults = async () => {
            setIsLoading(true);
            try {
                const response: any = await api.get('/requests/', {
                    params: {
                        search: debouncedQuery,
                        page_size: 8
                    }
                });

                if (isMounted) {
                    const data = Array.isArray(response) ? response : (response?.results || []);
                    setResults(data);
                    setIsOpen(true);
                    setSelectedIndex(-1);
                }
            } catch (error) {
                console.error('[GlobalSearch] Failed to search approval requests:', error);
                if (isMounted) {
                    setResults([]);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchResults();

        return () => {
            isMounted = false;
        };
    }, [debouncedQuery]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Global shortcut Ctrl+K / Cmd+K to focus search input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                setIsOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSelect = (item: ApprovalSearchItem) => {
        setIsOpen(false);
        setIsMobileOpen(false);
        setQuery('');
        navigate(`/workflow/${item.id}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            inputRef.current?.blur();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (results.length > 0) {
                setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (results.length > 0) {
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < results.length) {
                handleSelect(results[selectedIndex]);
            } else if (results.length > 0) {
                handleSelect(results[0]);
            }
        }
    };

    const clearSearch = () => {
        setQuery('');
        setDebouncedQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return <Badge variant="success" className="text-[11px] font-semibold">Approved</Badge>;
            case 'REJECTED':
                return <Badge variant="error" className="text-[11px] font-semibold">Rejected</Badge>;
            case 'IN_PROGRESS':
                return <Badge variant="info" className="text-[11px] font-semibold">In Progress</Badge>;
            case 'REVISED':
                return <Badge variant="warning" className="text-[11px] font-semibold">Revised</Badge>;
            default:
                return <Badge variant="secondary" className="text-[11px] font-semibold">{status}</Badge>;
        }
    };

    const getModuleBadge = (code?: string) => {
        const c = code?.toUpperCase();
        if (c === 'EORDER') {
            return (
                <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                    E-ORDER
                </span>
            );
        }
        if (c?.includes('PR') || c?.includes('NON-TRADE') || c?.includes('TRADE')) {
            return (
                <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                    PR NON-TRADE
                </span>
            );
        }
        if (c === 'FINANCE') {
            return (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    FINANCE
                </span>
            );
        }
        if (c === 'HR') {
            return (
                <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                    HR
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                {code || 'WORKFLOW'}
            </span>
        );
    };

    return (
        <div ref={containerRef} className="relative w-full max-w-xl">
            {/* Desktop Search Input */}
            <div className="relative hidden sm:block w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (!isOpen && e.target.value.trim().length >= 2) {
                            setIsOpen(true);
                        }
                    }}
                    onFocus={() => {
                        if (query.trim().length >= 2) {
                            setIsOpen(true);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search approvals, reference ID (PR, Filename)..."
                    className="w-full rounded-full border border-slate-200 bg-slate-50/70 py-2 pl-10 pr-24 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 shadow-sm"
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
                    {isLoading ? (
                        <Loader2 size={16} className="animate-spin text-blue-600" />
                    ) : query ? (
                        <button
                            type="button"
                            onClick={clearSearch}
                            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                            title="Clear search"
                        >
                            <X size={15} />
                        </button>
                    ) : (
                        <div className="hidden lg:flex items-center space-x-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 shadow-2xs pointer-events-none">
                            <span>⌘</span>
                            <span>K</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Search Button Trigger */}
            <div className="sm:hidden">
                <button
                    onClick={() => {
                        setIsMobileOpen(true);
                        setTimeout(() => mobileInputRef.current?.focus(), 100);
                    }}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Search"
                >
                    <Search size={20} />
                </button>
            </div>

            {/* Mobile Modal / Overlay Search */}
            {isMobileOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col p-4 sm:hidden">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="flex items-center border-b border-slate-100 px-3 py-2.5">
                            <Search className="text-slate-400 mr-2" size={18} />
                            <input
                                ref={mobileInputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search reference ID or title..."
                                className="flex-1 text-sm outline-none bg-transparent text-slate-800 placeholder-slate-400"
                            />
                            {isLoading ? (
                                <Loader2 size={18} className="animate-spin text-blue-600 ml-2" />
                            ) : query ? (
                                <button onClick={clearSearch} className="p-1 text-slate-400">
                                    <X size={18} />
                                </button>
                            ) : null}
                            <button
                                onClick={() => {
                                    setIsMobileOpen(false);
                                    setQuery('');
                                }}
                                className="ml-2 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1"
                            >
                                Cancel
                            </button>
                        </div>

                        {/* Mobile Results */}
                        <div className="overflow-y-auto p-2 divide-y divide-slate-100">
                            {renderSearchResults()}
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop Popover Results Dropdown */}
            {isOpen && (
                <div className="hidden sm:block absolute left-0 right-0 top-full mt-2 w-full md:min-w-[560px] max-w-2xl bg-white rounded-2xl border border-slate-200/90 shadow-2xl shadow-slate-200/60 z-50 overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100">
                        {renderSearchResults()}
                    </div>

                    {/* Footer helper */}
                    {results.length > 0 && (
                        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <CornerDownLeft size={12} className="text-slate-400" />
                                Tekan <strong>Enter</strong> untuk membuka item terpilih
                            </span>
                            <span>{results.length} hasil ditemukan</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    function renderSearchResults() {
        if (isLoading) {
            return (
                <div className="p-6 space-y-3">
                    <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
                        <Loader2 size={14} className="animate-spin text-blue-600" />
                        <span>Mencari approval untuk &quot;{query}&quot;...</span>
                    </div>
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="flex items-center space-x-3 p-3 rounded-xl bg-slate-50 animate-pulse">
                            <div className="h-9 w-9 rounded-lg bg-slate-200" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-1/3 bg-slate-200 rounded" />
                                <div className="h-3 w-2/3 bg-slate-100 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        if (debouncedQuery.length >= 2 && results.length === 0) {
            return (
                <div className="p-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                        <SearchX size={24} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                        Tidak ada approval ditemukan
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Tidak ada dokumen yang cocok dengan <span className="font-medium text-slate-700">&quot;{query}&quot;</span>.
                        Coba cari dengan Reference ID (contoh: nomor PR, PO, Filename) atau judul dokumen.
                    </p>
                </div>
            );
        }

        if (results.length > 0) {
            return (
                <div className="p-2 space-y-1">
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex justify-between items-center">
                        <span>Approvals & Reference IDs</span>
                        <span>{results.length} hasil</span>
                    </div>
                    {results.map((item, index) => {
                        const isSelected = index === selectedIndex;
                        return (
                            <div
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`group flex items-start justify-between gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                                    isSelected 
                                        ? 'bg-blue-50/80 ring-1 ring-blue-200 shadow-2xs' 
                                        : 'hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <FileText size={18} />
                                    </div>

                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {getModuleBadge(item.module_code || item.module_name)}
                                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100">
                                                <Hash size={11} className="text-blue-500" />
                                                {item.reference_id}
                                            </span>
                                            {getStatusBadge(item.status)}
                                        </div>

                                        <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                            {item.title}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                            {item.requester_name && (
                                                <span className="flex items-center gap-1">
                                                    <User size={12} className="text-slate-400" />
                                                    {item.requester_name}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Calendar size={12} className="text-slate-400" />
                                                {formatDate(item.created_at)}
                                            </span>
                                            {item.current_step_name && (
                                                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200">
                                                    <Clock size={10} />
                                                    {item.current_step_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-2 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all">
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        return null;
    }
};
