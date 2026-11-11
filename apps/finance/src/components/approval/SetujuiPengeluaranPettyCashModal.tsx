'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@suka/design-system'
import {
  X,
  Receipt,
  Store,
  User,
  Tag,
  Calendar,
  ExternalLink,
  CheckCircle2,
  ImageOff,
} from 'lucide-react'
import {
  labelKategoriPettyCash,
  useReviewPettyCashExpense,
  type PendingPettyCashExpense,
} from '@/hooks/usePettyCashExpenseApproval'
import { rupiah, tanggalWaktu } from '@/lib/format'

export function SetujuiPengeluaranPettyCashModal({
  expense,
  isOpen,
  onClose,
  onTolak,
  onGagal,
}: {
  expense: PendingPettyCashExpense
  isOpen: boolean
  onClose: () => void
  onTolak: () => void
  onGagal?: () => void
}) {
  const review = useReviewPettyCashExpense()
  const [imgError, setImgError] = useState(false)

  if (!isOpen) return null

  const setujui = () => {
    review.mutate(
      { expenseId: expense.id, action: 'approve' },
      {
        onSuccess: () => {
          toast.success(`Pengeluaran petty cash ${expense.outlet_nama} (${rupiah(expense.amount)}) disetujui`)
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Gagal menyetujui pengeluaran petty cash')
          onGagal?.()
        },
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-modal-pengeluaran-pc"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-suka-brown/10 bg-white p-5 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-suka-brown/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-suka-orange/10 text-suka-orange">
              <Receipt size={18} />
            </span>
            <div>
              <h2 id="judul-modal-pengeluaran-pc" className="font-display text-xl font-bold text-suka-brown">
                Verifikasi Pengeluaran Petty Cash
              </h2>
              <p className="text-xs text-suka-gray-500">
                Periksa rincian belanja dan foto struk sebelum menyetujui pemotongan kas kecil
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1 text-suka-gray-400 transition-colors hover:bg-suka-gray-100 hover:text-suka-ink"
          >
            <X size={20} />
          </button>
        </div>

        {/* Ringkasan Pengajuan */}
        <div className="mt-4 space-y-3 rounded-xl border border-suka-brown/10 bg-suka-cream/60 p-4 text-sm text-suka-ink">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Store size={15} className="mt-0.5 shrink-0 text-suka-orange" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-suka-gray-500">Outlet</div>
                <div className="truncate font-semibold text-suka-brown">{expense.outlet_nama}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <User size={15} className="mt-0.5 shrink-0 text-suka-orange" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-suka-gray-500">Diajukan Oleh</div>
                <div className="truncate font-semibold text-suka-ink">{expense.pengaju_nama ?? 'Kru Kasir'}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Tag size={15} className="mt-0.5 shrink-0 text-suka-orange" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-suka-gray-500">Kategori</div>
                <div className="truncate font-semibold text-suka-ink">{labelKategoriPettyCash(expense.category)}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar size={15} className="mt-0.5 shrink-0 text-suka-orange" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-suka-gray-500">Waktu Pengajuan</div>
                <div className="truncate font-semibold text-suka-ink">{tanggalWaktu(expense.created_at)}</div>
              </div>
            </div>
          </div>

          <div className="border-t border-suka-brown/10 pt-2.5">
            <div className="text-[11px] font-medium text-suka-gray-500">Keterangan Belanja</div>
            <div className="mt-0.5 font-medium text-suka-ink">{expense.description || '-'}</div>
          </div>

          <div className="flex items-baseline justify-between border-t border-suka-brown/10 pt-2.5">
            <span className="text-xs font-semibold text-suka-gray-600">Nominal Pengeluaran</span>
            <span className="font-display text-xl font-bold tabular-nums text-suka-brown">
              {rupiah(expense.amount)}
            </span>
          </div>
        </div>

        {/* Foto Bukti Struk */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-suka-gray-700">Foto Bukti Struk / Nota</span>
            {expense.receipt_url && (
              <a
                href={expense.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-suka-orange hover:underline"
              >
                Buka ukuran penuh
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {expense.receipt_url && !imgError ? (
            <a
              href={expense.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-suka-gray-200 bg-suka-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={expense.receipt_url}
                alt={`Struk pengeluaran ${expense.outlet_nama}`}
                onError={() => setImgError(true)}
                className="max-h-72 w-full object-contain"
              />
            </a>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <ImageOff size={16} className="shrink-0 text-amber-600" />
              <span>
                {expense.receipt_url
                  ? 'Pratinjau gambar tidak dapat dimuat langsung. Klik "Buka ukuran penuh" untuk melihat struk.'
                  : 'Tidak ada lampiran foto struk pada pengajuan ini.'}
              </span>
            </div>
          )}
        </div>

        {/* Info Dampak Saldo */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
          <span>
            Setelah disetujui, saldo Petty Cash di POS <b>{expense.outlet_nama}</b> otomatis terpotong sebesar{' '}
            <b>{rupiah(expense.amount)}</b> dan kasir dapat melanjutkan tutup shift.
          </span>
        </div>

        {/* Aksi */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-suka-brown/10 pt-4">
          <button
            type="button"
            onClick={onTolak}
            disabled={review.isPending}
            className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tolak Pengajuan
          </button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={review.isPending}>
              Batal
            </Button>
            <Button onClick={setujui} disabled={review.isPending}>
              {review.isPending ? 'Menyetujui…' : 'Setujui Pengeluaran'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
