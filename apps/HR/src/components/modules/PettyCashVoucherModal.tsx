'use client'

import { useRef } from 'react'
import { Printer, X, Receipt } from 'lucide-react'
import { Button } from '@suka/design-system'
import { formatRupiah } from '@/lib/format'
import type { TraineeRecord } from '@/hooks/useOnboarding'

interface PettyCashVoucherModalProps {
  trainee: TraineeRecord | null
  onClose: () => void
}

export function PettyCashVoucherModal({ trainee, onClose }: PettyCashVoucherModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!trainee) return null

  const handlePrint = () => {
    window.print()
  }

  const voucherNo = `PC-TRN-${trainee.id.slice(0, 6).toUpperCase()}-${new Date().toISOString().slice(2, 7).replace('-', '')}`
  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-suka-gray-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-suka-gray-500 hover:bg-stone-100 transition-colors print:hidden cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Printable Voucher Slip */}
        <div ref={printRef} className="space-y-4 text-suka-ink print:p-0">
          <div className="border-b-2 border-dashed border-stone-300 pb-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Receipt className="text-suka-orange" size={24} />
              <h2 className="text-lg font-black tracking-wider text-suka-brown uppercase">
                SUKA SHAWARMA
              </h2>
            </div>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">
              VOUCHER PENGELUARAN PETTY CASH OUTLET
            </p>
            <p className="text-[11px] font-mono text-stone-400 mt-0.5">No: {voucherNo}</p>
          </div>

          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-stone-500 font-medium">Keperluan:</span>
              <span className="font-bold text-suka-brown">Uang Makan Training 7 Hari (Tahap 1)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500 font-medium">Sumber Dana:</span>
              <span className="font-bold text-amber-900 font-mono">Petty Cash ({trainee.outlet_name})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500 font-medium">Tanggal Cetak:</span>
              <span className="font-medium text-stone-800">{todayFormatted}</span>
            </div>
          </div>

          {/* Trainee Details */}
          <div className="rounded-xl border border-stone-200 p-3.5 text-xs space-y-2">
            <div className="flex justify-between border-b border-stone-100 pb-1.5">
              <span className="text-stone-500 font-medium">Nama Trainee:</span>
              <span className="font-bold text-stone-900">{trainee.name}</span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-1.5">
              <span className="text-stone-500 font-medium">Sub-Role:</span>
              <span className="font-bold text-purple-700 capitalize">
                {trainee.sub_role.replace('_', ' ')}
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-1.5">
              <span className="text-stone-500 font-medium">Outlet Penugasan:</span>
              <span className="font-bold text-stone-800">{trainee.outlet_name}</span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-1.5">
              <span className="text-stone-500 font-medium">Mulai Training:</span>
              <span className="font-medium text-stone-800">{trainee.training_start_date || trainee.join_date || '-'}</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-stone-500 font-medium">Kehadiran 7 Hari:</span>
              <span className="font-bold text-emerald-700">
                {trainee.training_attendance_days} Hari Hadir (Rp 15.000 / hari)
              </span>
            </div>
          </div>

          {/* Total Box */}
          <div className="rounded-xl bg-[#FDF9F3] border-2 border-suka-orange/40 p-3.5 flex justify-between items-center shadow-xs">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-suka-gray-500 block">
                Total Dicairkan dari Kas Kecil
              </span>
              <span className="text-xs text-stone-600 font-medium">
                {trainee.training_attendance_days} hari &times; Rp 15.000
              </span>
            </div>
            <span className="text-xl font-black text-suka-orange font-mono">
              {formatRupiah(trainee.training_meal_allowance)}
            </span>
          </div>

          {/* Signature Boxes */}
          <div className="grid grid-cols-3 gap-2 pt-3 text-center text-[10px] text-stone-600">
            <div className="border border-stone-200 rounded-lg p-2 flex flex-col justify-between h-24">
              <span>Yang Menyerahkan (Kasir/Leader)</span>
              <div className="border-b border-stone-300 w-full mb-1"></div>
              <span className="font-mono text-[9px] text-stone-400">( .............................. )</span>
            </div>
            <div className="border border-stone-200 rounded-lg p-2 flex flex-col justify-between h-24">
              <span>Penerima (Trainee)</span>
              <div className="border-b border-stone-300 w-full mb-1"></div>
              <span className="font-mono text-[9px] text-stone-400">{trainee.name}</span>
            </div>
            <div className="border border-stone-200 rounded-lg p-2 flex flex-col justify-between h-24">
              <span>Mengetahui (AM / HR)</span>
              <div className="border-b border-stone-300 w-full mb-1"></div>
              <span className="font-mono text-[9px] text-stone-400">( .............................. )</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex justify-end gap-2 border-t border-stone-200 pt-4 print:hidden">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="rounded-xl px-4 py-2 font-bold text-xs"
          >
            Tutup
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            className="rounded-xl px-4 py-2 font-bold bg-suka-orange hover:bg-suka-orange/90 text-white text-xs gap-1.5"
          >
            <Printer size={15} /> Cetak Voucher
          </Button>
        </div>
      </div>
    </div>
  )
}
