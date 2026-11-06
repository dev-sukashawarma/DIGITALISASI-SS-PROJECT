'use client'

import { useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useRiwayatApproval, RIWAYAT_PER_HALAMAN } from '@/hooks/useRiwayatApproval'
import { LABEL_JENIS_RIWAYAT, URUTAN_JENIS_RIWAYAT, type JenisRiwayat } from '@/lib/approval/riwayat'
import { BarisRiwayat } from './BarisRiwayat'

export function RiwayatApprovalPanel({ enabled }: { enabled: boolean }) {
  const [jenis, setJenis] = useState<JenisRiwayat | null>(null)
  const [halaman, setHalaman] = useState(0)
  const { data, isLoading, isFetching, error } = useRiwayatApproval(enabled, jenis, halaman)

  const pilih = (j: JenisRiwayat | null) => {
    setJenis(j)
    setHalaman(0)
  }

  const total = data?.total ?? 0
  const jumlahHalaman = Math.max(1, Math.ceil(total / RIWAYAT_PER_HALAMAN))

  const chip = (j: JenisRiwayat | null, label: string) => (
    <button
      key={label}
      type="button"
      onClick={() => pilih(j)}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        jenis === j ? 'border-suka-brown bg-suka-brown text-white' : 'border-suka-brown/15 bg-white text-suka-ink hover:border-suka-brown/40'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chip(null, 'Semua')}
        {URUTAN_JENIS_RIWAYAT.map((j) => chip(j, LABEL_JENIS_RIWAYAT[j]))}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Gagal memuat riwayat: {(error as Error).message}</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-suka-brown/10 bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-suka-gray-500">
              <Loader2 size={18} className="animate-spin text-suka-orange" /> Memuat riwayat…
            </div>
          ) : !data || data.baris.length === 0 ? (
            <p className="py-16 text-center text-sm font-medium text-suka-gray-500">Belum ada riwayat keputusan</p>
          ) : (
            <>
              <div className="flex justify-between border-b border-suka-brown/5 bg-suka-cream/40 px-4 py-2 text-xs font-semibold text-suka-gray-600">
                <span>{total} keputusan</span>
                {isFetching && <Loader2 size={14} className="animate-spin text-suka-orange" />}
              </div>
              <ul>
                {data.baris.map((r) => (
                  <BarisRiwayat key={r.id} r={r} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {total > RIWAYAT_PER_HALAMAN && (
        <div className="flex items-center justify-end gap-3 text-xs font-semibold text-suka-gray-600">
          <button type="button" onClick={() => setHalaman((h) => Math.max(0, h - 1))} disabled={halaman === 0}
            className="rounded-lg border border-suka-brown/15 px-3 py-1.5 disabled:opacity-40">
            Sebelumnya
          </button>
          <span>Halaman {halaman + 1} dari {jumlahHalaman}</span>
          <button type="button" onClick={() => setHalaman((h) => Math.min(jumlahHalaman - 1, h + 1))} disabled={halaman >= jumlahHalaman - 1}
            className="rounded-lg border border-suka-brown/15 px-3 py-1.5 disabled:opacity-40">
            Berikutnya
          </button>
        </div>
      )}

      <p className="text-[11px] text-suka-gray-400">
        Keputusan sebelum 6 Nov 2026 diisi dari data lama: jam acc dan tolak petty cash tidak tercatat, dan penolakan PO lama tidak pernah tersimpan.
      </p>
    </div>
  )
}
