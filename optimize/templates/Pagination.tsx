'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@suka/design-system'

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (total <= 0) return null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-suka-gray-500">
      <span>
        Menampilkan <strong>{(page - 1) * pageSize + 1}</strong>–<strong>{Math.min(page * pageSize, total)}</strong> dari{' '}
        <strong>{total}</strong>
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-suka-gray-200 gap-1 font-bold"
          >
            <ChevronLeft size={14} /> Sebelumnya
          </Button>
          <span className="font-bold text-suka-ink">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-xl border border-suka-gray-200 gap-1 font-bold"
          >
            Berikutnya <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  )
}

/** Halaman aktif tidak boleh melewati jumlah halaman (mis. data berkurang). */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
}
