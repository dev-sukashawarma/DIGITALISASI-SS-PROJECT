'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShieldCheck, AlertCircle, X, Archive } from 'lucide-react'
import type { Outlet } from '@/lib/types'

export function DeleteOutletDialog({
  outlet, countRefs, onSoftDelete, onClose,
}: {
  outlet: Outlet
  countRefs: (id: string) => Promise<number>
  onSoftDelete: () => void
  onHardDelete?: () => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [refs, setRefs] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    let alive = true
    countRefs(outlet.id).then((n) => { if (alive) setRefs(n) }).catch(() => { if (alive) setRefs(-1) })
    return () => { alive = false }
  }, [outlet.id, countRefs])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-t-[28px] sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-suka-gray-200">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-suka-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-suka-ink uppercase tracking-tight">
                KONFIRMASI PENGHAPUSAN OUTLET (SOFT DELETE)
              </h1>
              <p className="text-xs text-suka-gray-500 font-medium">
                Cabang: <span className="font-bold text-suka-ink">{outlet.name}</span> ({outlet.slug})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-suka-gray-400 hover:text-suka-ink rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="py-4 space-y-3.5">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <strong className="font-bold block text-emerald-950 mb-0.5">
                Jaminan Integritas Data Riwayat & Omzet (100% Aman)
              </strong>
              Sistem menerapkan <strong>Soft Delete</strong>. Seluruh riwayat penjualan, omzet kasir, transaksi petty cash, mutasi stok barang, dan absensi masa lalu <strong>TIDAK AKAN HILANG</strong> dan tetap tersimpan utuh di database.
            </div>
          </div>

          <div className="rounded-xl bg-suka-gray-50 border border-suka-gray-200/80 p-3 text-xs text-suka-gray-600 space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-suka-gray-400">Tabel Database:</span>
              <span className="font-bold text-suka-ink">public.outlets</span>
            </div>
            <div className="flex justify-between">
              <span className="text-suka-gray-400">Status Baru:</span>
              <span className="font-bold text-amber-700">inactive (nonaktif)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-suka-gray-400">Flag Operasional:</span>
              <span className="font-bold text-red-700">is_active = false</span>
            </div>
            <div className="flex justify-between">
              <span className="text-suka-gray-400">Waktu Penghapusan:</span>
              <span className="font-bold text-suka-ink">deleted_at = NOW()</span>
            </div>
          </div>

          {refs === null ? (
            <p className="text-xs text-suka-gray-400 italic">Memeriksa referensi data terkait...</p>
          ) : refs > 0 ? (
            <div className="flex items-center gap-2 text-xs text-suka-gray-600">
              <AlertCircle className="w-4 h-4 text-suka-orange shrink-0" />
              <span>
                Ditemukan <strong className="text-suka-ink">{refs}</strong> catatan relasi (transaksi/stok/karyawan) yang terlindungi.
              </span>
            </div>
          ) : null}
        </div>

        {/* Actions footer */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-suka-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 min-h-[44px] text-xs font-bold text-suka-gray-600 hover:bg-suka-gray-100 border border-suka-gray-200 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSoftDelete}
            className="rounded-xl px-4 py-2.5 min-h-[44px] text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Archive className="w-4 h-4" />
            Nonaktifkan Outlet (Soft Delete)
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

