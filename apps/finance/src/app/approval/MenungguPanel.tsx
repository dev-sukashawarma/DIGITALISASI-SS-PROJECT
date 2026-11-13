'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { rupiah } from '@/lib/format'
import {
  AMBANG_LAMA_JAM,
  JENIS_LABEL,
  pisahMenurutUmur,
  totalPerJenis,
  URUTAN_JENIS,
  type HubItem,
  type HubJenis,
} from '@/lib/approval/hub'
import { BarisHub, IKON_JENIS_HUB } from './BarisHub'

type Saringan = 'semua' | HubJenis

export function MenungguPanel({
  items,
  galat,
  isLoading,
  perJenis,
  now,
  bolehPutuskan,
  onSetujui,
  onTolak,
}: {
  items: HubItem[]
  galat: HubJenis[]
  isLoading: boolean
  perJenis: Record<HubJenis, number>
  now: Date
  bolehPutuskan: boolean
  onSetujui: (i: HubItem) => void
  onTolak: (i: HubItem) => void
}) {
  const [saringan, setSaringan] = useState<Saringan>('semua')
  const totalJenis = useMemo(() => totalPerJenis(items), [items])
  const tampil = useMemo(() => (saringan === 'semua' ? items : items.filter((i) => i.jenis === saringan)), [items, saringan])
  const { lama, baru } = useMemo(() => pisahMenurutUmur(tampil, now), [tampil, now])
  const totalSemua = useMemo(() => items.reduce((a, i) => a + i.nominal, 0), [items])

  const kartu = (key: Saringan, label: string, jumlah: number, total: number, gagal: boolean) => {
    const aktif = saringan === key
    const Ikon = key === 'semua' ? null : IKON_JENIS_HUB[key]
    return (
      <button
        key={key}
        type="button"
        onClick={() => setSaringan(key)}
        aria-pressed={aktif}
        className={`rounded-2xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-suka-orange ${
          aktif ? 'border-suka-brown bg-suka-brown text-white' : 'border-suka-brown/10 bg-white text-suka-ink hover:border-suka-brown/30'
        }`}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
          {Ikon && <Ikon size={13} aria-hidden="true" />}
          {label}
        </span>
        {gagal ? (
          <span className={`mt-1 block text-sm font-semibold ${aktif ? 'text-white' : 'text-red-600'}`}>Gagal dimuat</span>
        ) : (
          <>
            <span className="mt-1 block font-display text-2xl tabular-nums">{jumlah}</span>
            <span className={`block truncate text-[11px] tabular-nums ${aktif ? 'text-white/70' : 'text-suka-gray-500'}`}>{rupiah(total)}</span>
          </>
        )}
      </button>
    )
  }

  const kelompok = (judul: string, keterangan: string, isi: HubItem[], mendesak: boolean) =>
    isi.length > 0 && (
      <section aria-label={judul} className="overflow-hidden rounded-2xl border border-suka-brown/10 bg-white">
        <header
          className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-2.5 ${
            mendesak ? 'border-red-100 bg-red-50/70' : 'border-suka-brown/5 bg-suka-cream/50'
          }`}
        >
          <h3 className={`font-display text-lg ${mendesak ? 'text-red-700' : 'text-suka-brown'}`}>{judul}</h3>
          <p className="text-xs text-suka-gray-500">
            <span className="font-semibold text-suka-ink">{isi.length}</span> pengajuan, total{' '}
            <span className="font-semibold tabular-nums text-suka-ink">{rupiah(isi.reduce((a, i) => a + i.nominal, 0))}</span>
          </p>
          <p className="w-full text-xs text-suka-gray-500">{keterangan}</p>
        </header>
        <ul className="divide-y divide-suka-brown/5">
          {isi.map((i) => (
            <BarisHub key={i.key} item={i} now={now} bolehPutuskan={bolehPutuskan} onSetujui={onSetujui} onTolak={onTolak} />
          ))}
        </ul>
      </section>
    )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label="Saring menurut jenis pengajuan">
        {kartu('semua', 'Semua', items.length, totalSemua, false)}
        {/* Pengeluaran petty cash POS kini disetujui AM di app Manager (13 Nov 2026), bukan Finance. */}
        {URUTAN_JENIS.filter((j) => j !== 'pengeluaran_petty_cash').map((j) =>
          kartu(j, JENIS_LABEL[j], perJenis[j], totalJenis[j], galat.includes(j)),
        )}
      </div>

      {galat.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {galat.map((j) => JENIS_LABEL[j]).join(', ')} gagal dimuat, jadi belum ikut dihitung. Bagian lain tetap tampil. Muat ulang
            halaman untuk mencoba lagi.
          </span>
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-suka-brown/10 bg-white py-16 text-sm text-suka-gray-500">
          <Loader2 size={18} className="animate-spin text-suka-orange" /> Memuat pengajuan…
        </div>
      ) : tampil.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-suka-brown/10 bg-white py-16 text-center">
          <CheckCircle2 size={28} className="text-emerald-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-suka-ink">Tidak ada pengajuan yang menunggu</p>
          <p className="text-xs text-suka-gray-500">Pengajuan baru muncul di sini begitu masuk ke finance.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {kelompok(
            `Lewat ${AMBANG_LAMA_JAM} jam`,
            'Paling lama menunggu di atas. Dahulukan yang ini.',
            lama,
            true,
          )}
          {kelompok('Baru masuk', `Masuk kurang dari ${AMBANG_LAMA_JAM} jam terakhir.`, baru, false)}
        </div>
      )}
    </div>
  )
}
