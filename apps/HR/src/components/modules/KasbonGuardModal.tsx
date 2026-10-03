'use client'

import Link from 'next/link'
import { AlertTriangle, ExternalLink, X, Clock, User, Building2 } from 'lucide-react'
import { Button } from '@suka/design-system'
import { formatRupiah } from '@/lib/format'

export interface PendingKasbonItem {
  id: string
  staff_id: string
  amount: number
  remaining: number
  created_at: string
  reason: string | null
  outlet_staff?: {
    name: string
    role: string
    outlets?: { name: string } | null
  }
}

interface KasbonGuardModalProps {
  isOpen: boolean
  onClose: () => void
  pendingKasbons: PendingKasbonItem[]
  targetStaffName?: string | null
  onProceedAnyway?: () => void
}

export function KasbonGuardModal({
  isOpen,
  onClose,
  pendingKasbons,
  targetStaffName,
  onProceedAnyway,
}: KasbonGuardModalProps) {
  if (!isOpen) return null

  const totalPendingAmount = pendingKasbons.reduce(
    (sum, k) => sum + (Number(k.amount) || 0),
    0
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 my-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-suka-brown">
                Guard Finalisasi: Kasbon Menunggu Persetujuan
              </h3>
              <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
                {targetStaffName
                  ? `Pengajuan kasbon untuk ${targetStaffName} belum diputuskan oleh HR.`
                  : `Terdapat ${pendingKasbons.length} pengajuan kasbon yang belum disetujui / ditolak.`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-suka-gray-400 hover:text-suka-ink hover:bg-stone-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="rounded-2xl bg-amber-50/80 border border-amber-300/80 p-3.5 space-y-1.5 text-xs">
          <p className="font-bold text-amber-950 flex items-center gap-1.5">
            <Clock size={14} className="text-amber-600" />
            <span>Persetujuan Kasbon Diperlukan</span>
          </p>
          <p className="text-amber-900 leading-relaxed">
            Slip gaji <strong>tidak boleh memotong kasbon yang statusnya masih &quot;Menunggu Persetujuan&quot;</strong>.
            Mohon lakukan persetujuan (<span className="text-emerald-800 font-bold">Setujui</span> atau{' '}
            <span className="text-red-800 font-bold">Tolak</span>) di Modul Kasbon terlebih dahulu agar
            pemotongan gaji dan sisa hutang karyawan tercatat akurat.
          </p>
          <div className="pt-1 flex items-center justify-between font-mono font-bold text-amber-950 border-t border-amber-200">
            <span>Total Nilai Kasbon Pending:</span>
            <span className="text-sm text-red-700">{formatRupiah(totalPendingAmount)}</span>
          </div>
        </div>

        {/* List of Pending Cash Advances */}
        <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[300px] pr-1">
          <p className="text-xs font-bold text-suka-brown uppercase tracking-wider">
            Daftar Pengajuan yang Memerlukan Tindakan ({pendingKasbons.length}):
          </p>
          <div className="space-y-2">
            {pendingKasbons.map((k) => {
              const staff = k.outlet_staff
              const staffName = staff?.name || 'Karyawan'
              const roleName = staff?.role?.replace('_', ' ') || 'Staff'
              const outletName = staff?.outlets?.name || 'Pusat'
              const reqDate = k.created_at
                ? new Date(k.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '-'

              return (
                <div
                  key={k.id}
                  className="p-3 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-all text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-suka-ink">
                      <User size={13} className="text-stone-400" />
                      <span>{staffName}</span>
                      <span className="text-[10px] text-stone-500 font-normal">({roleName})</span>
                    </div>
                    <span className="font-mono font-black text-red-600 text-xs">
                      {formatRupiah(k.amount)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-stone-500 gap-1">
                    <span className="flex items-center gap-1">
                      <Building2 size={11} className="text-stone-400" />
                      <span>{outletName}</span>
                      <span>&bull;</span>
                      <span>{reqDate}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
                      Menunggu Persetujuan
                    </span>
                  </div>

                  {k.reason && (
                    <p className="text-[11px] text-stone-600 italic bg-white p-2 rounded-xl border border-stone-200/60 mt-1">
                      &quot;{k.reason}&quot;
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-stone-100 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {onProceedAnyway ? (
            <button
              type="button"
              onClick={onProceedAnyway}
              className="text-[11px] text-stone-400 hover:text-stone-600 underline cursor-pointer"
            >
              Abaikan &amp; Tetap Finalisasi (Tanpa Kasbon Pending)
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl font-bold text-xs"
            >
              Tutup
            </Button>
            <Link
              href="/perizinan/kasbon"
              className="px-4 py-2 bg-suka-orange hover:bg-suka-orange/90 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all text-center justify-center cursor-pointer"
            >
              <span>Buka Menu Kasbon &amp; Approval</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
