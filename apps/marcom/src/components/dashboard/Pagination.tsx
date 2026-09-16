'use client'

import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  itemName?: string
  className?: string
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemName = 'konten',
  className = '',
}: PaginationProps) {
  if (totalItems === 0) return null

  const startIndex = Math.min((currentPage - 1) * pageSize + 1, totalItems)
  const endIndex = Math.min(currentPage * pageSize, totalItems)

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      let start = Math.max(2, currentPage - 1)
      let end = Math.min(totalPages - 1, currentPage + 1)

      if (currentPage <= 3) {
        start = 2
        end = 4
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3
        end = totalPages - 1
      }

      if (start > 2) {
        pages.push('ellipsis-start')
      }

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (end < totalPages - 1) {
        pages.push('ellipsis-end')
      }

      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div
      className={`px-4 sm:px-6 py-3.5 bg-[#FAF8F5]/80 border-t border-[#EFE8DE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600 ${className}`}
    >
      {/* Left side: Information & Page Size selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 w-full sm:w-auto">
        <div className="font-medium text-stone-600">
          Menampilkan{' '}
          <span className="font-bold text-[#1A1715] font-mono">
            {startIndex} - {endIndex}
          </span>{' '}
          dari{' '}
          <span className="font-bold text-[#1A1715] font-mono">
            {totalItems}
          </span>{' '}
          {itemName}
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-0 sm:pl-3 sm:border-l border-[#EFE8DE]">
            <span className="text-stone-400 text-[11px]">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-[#EFE8DE] rounded-lg text-xs font-bold text-stone-700 focus:outline-none focus:border-[#D9480F] cursor-pointer shadow-2xs transition-colors"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / hal
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Page navigation buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-[#EFE8DE] bg-white text-stone-600 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          title="Halaman Pertama"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-[#EFE8DE] bg-white text-stone-600 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          title="Halaman Sebelumnya"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-0.5">
          {pageNumbers.map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-stone-400 font-bold tracking-widest text-[11px] select-none"
                >
                  ...
                </span>
              )
            }

            const isActive = p === currentPage
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#D9480F] text-white shadow-xs'
                    : 'bg-white border border-[#EFE8DE] text-stone-700 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 shadow-2xs'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-[#EFE8DE] bg-white text-stone-600 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          title="Halaman Selanjutnya"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-[#EFE8DE] bg-white text-stone-600 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          title="Halaman Terakhir"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
