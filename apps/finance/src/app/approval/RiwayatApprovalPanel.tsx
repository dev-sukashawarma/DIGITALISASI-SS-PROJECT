'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRiwayatApproval, useRingkasanRiwayat, RIWAYAT_PER_HALAMAN } from '@/hooks/useRiwayatApproval'
import { rupiah } from '@/lib/format'
import {
  kelompokkanPerHari,
  LABEL_JENIS_RIWAYAT,
  URUTAN_JENIS_RIWAYAT,
  type JenisRiwayat,
  type KeputusanRiwayat,
} from '@/lib/approval/riwayat'
import { BarisRiwayat, IKON_JENIS, WARNA_KEPUTUSAN } from './BarisRiwayat'

const SARINGAN_KEPUTUSAN: { nilai: KeputusanRiwayat | null; label: string }[] = [
  { nilai: null, label: 'Semua keputusan' },
  { nilai: 'setuju', label: 'Disetujui' },
  { nilai: 'tolak', label: 'Ditolak' },
  { nilai: 'serah_am', label: 'Diserahkan ke AM' },
]

export function RiwayatApprovalPanel({ enabled }: { enabled: boolean }) {
  const [jenis, setJenis] = useState<JenisRiwayat | null>(null)
  const [keputusan, setKeputusan] = useState<KeputusanRiwayat | null>(null)
  const [halaman, setHalaman] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const { data, isLoading, isFetching, error } = useRiwayatApproval(enabled, jenis, keputusan, halaman)
  const { data: ringkasan } = useRingkasanRiwayat(enabled, jenis)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const grup = useMemo(() => kelompokkanPerHari(data?.baris ?? [], now), [data, now])
  const total = data?.total ?? 0
  const jumlahHalaman = Math.max(1, Math.ceil(total / RIWAYAT_PER_HALAMAN))
  const semua = ringkasan ? ringkasan.setuju + ringkasan.tolak + ringkasan.serah_am : null

  const pilihJenis = (j: JenisRiwayat | null) => {
    setJenis(j)
    setHalaman(0)
  }
  const pilihKeputusan = (k: KeputusanRiwayat | null) => {
    setKeputusan(k)
    setHalaman(0)
  }

  return (
    <div className="space-y-5">
      {/* Ringkasan sekaligus saringan keputusan */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Saring menurut keputusan">
        {SARINGAN_KEPUTUSAN.map(({ nilai, label }) => {
          const aktif = keputusan === nilai
          const jumlah = nilai === null ? semua : ringkasan?.[nilai]
          return (
            <button
              key={label}
              type="button"
              onClick={() => pilihKeputusan(nilai)}
              aria-pressed={aktif}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-suka-orange ${
                aktif ? 'border-suka-brown bg-suka-brown text-white' : 'border-suka-brown/10 bg-white text-suka-ink hover:border-suka-brown/30'
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
                {nilai && <span className={`h-2 w-2 rounded-full ${WARNA_KEPUTUSAN[nilai].titik}`} aria-hidden="true" />}
                {label}
              </span>
              <span className="mt-1 block font-display text-2xl tabular-nums">{jumlah ?? '…'}</span>
            </button>
          )
        })}
      </div>

      {/* Saringan jenis */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Saring menurut jenis pengajuan">
        {[null, ...URUTAN_JENIS_RIWAYAT].map((j) => {
          const aktif = jenis === j
          const Ikon = j ? IKON_JENIS[j] : null
          return (
            <button
              key={j ?? 'semua'}
              type="button"
              onClick={() => pilihJenis(j)}
              aria-pressed={aktif}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-suka-orange ${
                aktif ? 'border-suka-orange bg-suka-orange/10 text-suka-brown' : 'border-suka-brown/15 bg-white text-suka-gray-600 hover:border-suka-brown/40'
              }`}
            >
              {Ikon && <Ikon size={13} aria-hidden="true" />}
              {j ? LABEL_JENIS_RIWAYAT[j] : 'Semua jenis'}
            </button>
          )
        })}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Riwayat gagal dimuat: {(error as Error).message}. Muat ulang halaman untuk mencoba lagi.</span>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-suka-brown/10 bg-white py-16 text-sm text-suka-gray-500">
          <Loader2 size={18} className="animate-spin text-suka-orange" /> Memuat riwayat…
        </div>
      ) : grup.length === 0 ? (
        <p className="rounded-2xl border border-suka-brown/10 bg-white py-16 text-center text-sm font-medium text-suka-gray-500">
          Belum ada keputusan untuk saringan ini.
        </p>
      ) : (
        <div className={`space-y-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {grup.map((g) => (
            <section key={g.kunci} className="overflow-hidden rounded-2xl border border-suka-brown/10 bg-white">
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-suka-brown/5 bg-suka-cream/50 px-4 py-2.5">
                <h3 className="font-display text-lg text-suka-brown">{g.label}</h3>
                <p className="text-xs text-suka-gray-500">
                  <span className="font-semibold text-suka-ink">{g.baris.length}</span> keputusan, total{' '}
                  <span className="font-semibold tabular-nums text-suka-ink">{rupiah(g.total)}</span>
                </p>
                {g.kunci === 'tanpa-jam' && (
                  <p className="w-full text-xs text-suka-gray-500">
                    Keputusan sebelum riwayat dicatat (6 Nov 2026). Jam acc dan tolak petty cash lama tidak tersimpan, jadi
                    urutannya mengikuti tanggal pengajuan.
                  </p>
                )}
              </header>
              {/* Rel garis waktu: garis di tengah kolom titik (3.25rem jam + gap + 0.75rem). */}
              <div className="relative px-3 sm:px-4">
                <span
                  className="pointer-events-none absolute bottom-3 top-3 w-px bg-suka-brown/10 left-[calc(0.75rem+3.25rem+0.5rem+0.75rem)] sm:left-[calc(1rem+3.25rem+0.75rem+0.75rem)]"
                  aria-hidden="true"
                />
                <ul className="divide-y divide-suka-brown/5">
                  {g.baris.map((r) => (
                    <BarisRiwayat key={r.id} r={r} />
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}

      {total > RIWAYAT_PER_HALAMAN && (
        <nav className="flex items-center justify-between gap-3 text-xs font-semibold text-suka-gray-600" aria-label="Halaman riwayat">
          <span>
            {halaman * RIWAYAT_PER_HALAMAN + 1}–{Math.min(total, (halaman + 1) * RIWAYAT_PER_HALAMAN)} dari {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHalaman((h) => Math.max(0, h - 1))}
              disabled={halaman === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-suka-brown/15 bg-white px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft size={14} aria-hidden="true" /> Lebih baru
            </button>
            <button
              type="button"
              onClick={() => setHalaman((h) => Math.min(jumlahHalaman - 1, h + 1))}
              disabled={halaman >= jumlahHalaman - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-suka-brown/15 bg-white px-3 py-1.5 disabled:opacity-40"
            >
              Lebih lama <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
