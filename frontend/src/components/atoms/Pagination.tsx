import React from 'react';
import { 
    ChevronLeft, 
    ChevronRight, 
    ChevronsLeft, 
    ChevronsRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaginationProps {
    currentPage: number;
    pageSize: number;
    totalCount: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    pageSize,
    totalCount,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 20, 50],
    className,
}) => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalCount);

    // Generate page numbers with ellipsis
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow + 2) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);
            if (currentPage > 3) {
                pages.push('...');
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }
            pages.push(totalPages);
        }

        return pages;
    };

    return (
        <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-white border-t border-slate-200/80 rounded-b-xl text-sm text-slate-600', className)}>
            {/* Info and Page Size Selector */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                <span>
                    Showing <strong className="font-semibold text-slate-900">{startItem}</strong> to{' '}
                    <strong className="font-semibold text-slate-900">{endItem}</strong> of{' '}
                    <strong className="font-semibold text-slate-900">{totalCount}</strong> results
                </span>

                {onPageSizeChange && (
                    <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                        <span className="text-xs text-slate-500">Show:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                onPageSizeChange(Number(e.target.value));
                                onPageChange(1); // Reset to first page
                            }}
                            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
                        >
                            {pageSizeOptions.map((size) => (
                                <option key={size} value={size}>
                                    {size} / page
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center space-x-1">
                {/* First Page */}
                <button
                    type="button"
                    onClick={() => onPageChange(1)}
                    disabled={currentPage <= 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none"
                    title="First page"
                >
                    <ChevronsLeft size={15} />
                </button>

                {/* Previous Page */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none"
                    title="Previous page"
                >
                    <ChevronLeft size={15} />
                </button>

                {/* Page Numbers */}
                <div className="hidden sm:flex items-center space-x-1">
                    {getPageNumbers().map((page, idx) => {
                        if (page === '...') {
                            return (
                                <span
                                    key={`ellipsis-${idx}`}
                                    className="px-2 text-xs font-semibold text-slate-400 select-none"
                                >
                                    ...
                                </span>
                            );
                        }

                        const isCurrent = page === currentPage;
                        return (
                            <button
                                key={`page-${page}`}
                                type="button"
                                onClick={() => onPageChange(page as number)}
                                className={cn(
                                    'inline-flex h-8 min-w-[32px] px-2 items-center justify-center rounded-lg text-xs font-medium transition-all',
                                    isCurrent
                                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                )}
                            >
                                {page}
                            </button>
                        );
                    })}
                </div>

                {/* Current page indicator for small screens */}
                <span className="sm:hidden px-2 text-xs font-medium text-slate-600">
                    Page {currentPage} of {totalPages}
                </span>

                {/* Next Page */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none"
                    title="Next page"
                >
                    <ChevronRight size={15} />
                </button>

                {/* Last Page */}
                <button
                    type="button"
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none"
                    title="Last page"
                >
                    <ChevronsRight size={15} />
                </button>
            </div>
        </div>
    );
};
