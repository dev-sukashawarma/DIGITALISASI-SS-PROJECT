'use client'
// Badge status budget untuk role yang TIDAK boleh melihat harga beli (crew,
// leader). Sengaja tanpa angka rupiah: server (estimateCartValue mode 'status')
// hanya mengirim status + persen pemakaian budget yang sudah dibulatkan 5%.
// Pembaca harga tetap memakai BudgetBadge (rupiah).
import { Wallet, AlertTriangle } from 'lucide-react'
import type { EstimasiKeranjangStatus, StatusBudgetKeranjang } from '@/lib/stok/estimasiKeranjang'

const TAMPILAN: Record<StatusBudgetKeranjang, { label: string; kotak: string; bar: string; ikon: string }> = {
  belum_diatur: {
    label: 'Budget belum diatur',
    kotak: 'bg-stone-50 text-stone-700 border-stone-200',
    bar: 'bg-stone-300',
    ikon: 'text-stone-500',
  },
  cukup: {
    label: 'Masih cukup',
    kotak: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    bar: 'bg-emerald-500',
    ikon: 'text-emerald-600',
  },
  mendekati: {
    label: 'Mendekati batas',
    kotak: 'bg-amber-50 text-amber-800 border-amber-200/80',
    bar: 'bg-amber-500',
    ikon: 'text-amber-600',
  },
  melebihi: {
    label: 'Melebihi budget',
    kotak: 'bg-red-50 text-red-800 border-red-200/80',
    bar: 'bg-red-500',
    ikon: 'text-red-600',
  },
}

export function BudgetStatusKeranjang({
  hasil,
  gagal = false,
}: {
  hasil: EstimasiKeranjangStatus | null
  gagal?: boolean
}) {
  if (!hasil) {
    return (
      <div className="text-xs font-bold p-3.5 rounded-2xl border border-suka-brown/10 bg-white text-suka-brown/50 shadow-2xs">
        {gagal ? 'Status budget outlet belum bisa dimuat. Permintaan tetap bisa dikirim.' : 'Mengecek budget outlet…'}
      </div>
    )
  }

  const t = TAMPILAN[hasil.status]
  const persen = hasil.persenSetelah

  if (hasil.status === 'belum_diatur') {
    return (
      <div className={`text-xs font-bold p-3.5 rounded-2xl border shadow-2xs ${t.kotak}`}>
        <div className="flex items-start gap-2.5">
          <Wallet className={`w-4 h-4 mt-0.5 shrink-0 ${t.ikon}`} />
          <div className="space-y-0.5">
            <span className="block">{t.label}</span>
            <span className="block font-medium text-[11px] opacity-80">
              Outlet ini belum punya plafon budget. Permintaan tetap bisa dikirim.
            </span>
          </div>
        </div>
      </div>
    )
  }

  const keteranganPersen =
    persen == null
      ? 'Plafon budget outlet belum diisi dengan benar.'
      : hasil.status === 'melebihi'
      ? 'Budget periode ini akan terlampaui (lebih dari 100%) bila permintaan ini disetujui.'
      : `Sekitar ${persen}% budget periode ini terpakai bila permintaan ini disetujui.`

  return (
    <div className={`text-xs font-bold p-3.5 rounded-2xl border shadow-2xs ${t.kotak}`}>
      <div className="flex items-start gap-2.5">
        {hasil.status === 'melebihi' ? (
          <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${t.ikon}`} />
        ) : (
          <Wallet className={`w-4 h-4 mt-0.5 shrink-0 ${t.ikon}`} />
        )}
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-black">{t.label}</span>
            {persen != null && (
              <span className="text-[11px] font-extrabold opacity-80">
                {hasil.status === 'melebihi' ? '>100%' : `±${persen}%`}
              </span>
            )}
            <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 shadow-2xs">
              Tahap Developer (Bisa Diabaikan)
            </span>
          </div>
          {persen != null && (
            <div
              className="h-2 w-full rounded-full bg-white/80 border border-black/5 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={persen}
              aria-label="Perkiraan pemakaian budget setelah permintaan ini"
            >
              <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.min(100, Math.max(0, persen))}%` }} />
            </div>
          )}
          <span className="block font-medium opacity-80 text-[11px]">{keteranganPersen}</span>
          {hasil.status === 'melebihi' && (
            <span className="block font-medium text-[11px]">
              Pengajuan tetap dapat dikirim; keputusan ada di Gudang Pusat.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
