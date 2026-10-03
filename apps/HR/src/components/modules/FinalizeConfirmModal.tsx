'use client'

import { AlertCircle, CheckCircle2, Lock, ShieldCheck, X } from 'lucide-react'
import { Button } from '@suka/design-system'
import { formatRupiah } from '@/lib/format'

interface FinalizeConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
  periodText: string
  totalSlips: number
  totalTHP: number
  totalKasbonDeduction: number
}

export function FinalizeConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isPending,
  periodText,
  totalSlips,
  totalTHP,
  totalKasbonDeduction,
}: FinalizeConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 my-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-suka-ink">
                Konfirmasi Finalisasi Penggajian
              </h3>
              <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
                Periode {periodText}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1 rounded-lg text-suka-gray-400 hover:text-suka-ink hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ringkasan Data yang akan difinalisasi */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
              Jumlah Slip Gaji
            </span>
            <span className="text-lg font-black text-suka-ink mt-0.5 block">
              {totalSlips} <span className="text-xs font-normal text-stone-500">Karyawan</span>
            </span>
          </div>
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
              Total Pengeluaran THP
            </span>
            <span className="text-lg font-black text-emerald-700 font-mono mt-0.5 block">
              {formatRupiah(totalTHP)}
            </span>
          </div>
        </div>

        {/* Status Kasbon Guard Check */}
        <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
          <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
          <div>
            <p className="font-bold">Kasbon Guard: Lolos Verifikasi</p>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Tidak ada permohonan kasbon pending. Potongan cicilan kasbon senilai{' '}
              <strong>{formatRupiah(totalKasbonDeduction)}</strong> akan otomatis memotong sisa hutang karyawan secara resmi.
            </p>
          </div>
        </div>

        {/* Peringatan Dampak Finalisasi */}
        <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-1.5 text-xs text-amber-950">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <span>Perhatian Sebelum Melanjutkan:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-stone-700 text-[11px] pl-1">
            <li>Slip yang sudah final <strong>terkunci permanen</strong> dan tidak bisa diedit kembali tanpa pembukaan kunci khusus.</li>
            <li>Slip resmi siap dikirim langsung secara massal via WhatsApp kepada seluruh staf.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
            className="text-stone-600 hover:text-stone-900 text-xs font-bold"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-suka-brown hover:bg-suka-brown/90 text-white font-bold rounded-xl text-xs px-5 shadow-sm"
          >
            {isPending ? 'Memproses Finalisasi...' : 'Ya, Finalize Semua Sekarang'}
          </Button>
        </div>
      </div>
    </div>
  )
}
