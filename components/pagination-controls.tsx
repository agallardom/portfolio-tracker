'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface PaginationControlsProps {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    sectionId?: string;
}

export function PaginationControls({
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    sectionId = 'transactions-section'
}: PaginationControlsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set(name, value);

            // Reset to page 1 if changing page size
            if (name === 'pageSize') {
                params.set('page', '1');
            }

            return params.toString();
        },
        [searchParams]
    );

    const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = event.target.value;
        router.push(`?${createQueryString('pageSize', newSize)}#${sectionId}`);
    };

    const handlePageChange = (newPage: number) => {
        router.push(`?${createQueryString('page', newPage.toString())}#${sectionId}`);
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5 gap-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                    Page {page} of {totalPages} ({total} items)
                </span>
                <div className="flex items-center gap-2">
                    <label htmlFor="pageSize" className="whitespace-nowrap">Rows per page:</label>
                    <select
                        id="pageSize"
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        className="bg-black/20 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-white/20"
                    >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={!hasPreviousPage}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={!hasNextPage}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
