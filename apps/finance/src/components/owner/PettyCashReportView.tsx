'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Download,
  FileWarning,
  Receipt,
  Scale,
  Search,
  X,
} from 'lucide-react'
import type { Outlet } from '@/lib/types'
import { rupiah } from '@/lib/format'
import {
  daftarKategori,
  jamWib,
  kelompokkanPerHari,
  labelKategori,
  perOutlet,
  ringkas,
  saring,
  type TipeSaringan,
} from '@/lib/pettyCash/laporan'

export interface PettyCashTransaction {
  id: string
  outlet_id: string
  outlet_name: string
  transaction_date: string
  type: 'in' | 'out'
  category: string
  description: string
  amount: number
  staff_name: string
  receipt_url: string | null
}

export interface DailyPettyCashSummary {
  date: string
  total_in: number
  total_out: number
  ending_balance: number
  shift_count: number
}

interface PettyCashReportViewProps {
  outlets: Outlet[]
  transactions: PettyCashTransaction[]
  /** Tidak dipakai lagi: rekap harian kini dihitung dari baris yang tampil. */
  dailySummaries?: DailyPettyCashSummary[]
  selectedOutletId: string
  onOutletChange: (outletId: string) => void
  dateFrom: string
  dateTo: string
}

const BATAS_AWAL = 150

/* ── Modal bukti nota ─────────────────────────────────────────── */

function NotaModal({ tx, onClose }: { tx: PettyCashTransaction | null; onClose: () => void }) {
  useEffect(() => {
    if (!tx) return
    const tutup = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', tutup)
    return () => window.removeEventListener('keydown', tutup)
  }, [tx, onClose])

  if (!tx?.receipt_url) return null
  const judul = `${labelKategori(tx.category)} · ${rupiah(tx.amount)}`

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-suka-ink/70 p-3 backdrop-blur-sm print:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Bukti nota ${judul}`}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-suka-brown/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-suka-ink">{judul}</p>
            <p className="truncate text-xs text-suka-gray-500">
              {tx.outlet_name} · {tx.staff_name} · {jamWib(tx.transaction_date)} WIB
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-suka-gray-500 hover:bg-suka-cream hover:text-suka-ink"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-suka-ink p-3">
          <img src={tx.receipt_url} alt={`Nota ${judul}`} className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain" />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-suka-brown/10 px-4 py-3">
          <a
            href={tx.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-suka-brown/15 px-3 py-1.5 text-xs font-semibold text-suka-ink hover:bg-suka-cream"
          >
            <Download size={14} /> Unduh nota
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-suka-brown px-4 py-1.5 text-xs font-semibold text-white hover:bg-suka-brown/90"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Kartu ringkasan yang sekaligus saringan tipe ─────────────── */

function KartuRingkas({
  label,
  nilai,
  sub,
  ikon: Ikon,
  warna,
  aktif,
  onClick,
}: {
  label: string
  nilai: string
  sub: string
  ikon: typeof Scale
  warna: string
  aktif?: boolean
  onClick?: () => void
}) {
  const isi = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
        <Ikon size={14} className={aktif ? '' : warna} aria-hidden="true" />
        {label}
      </span>
      <span className="mt-1 block font-display text-xl tabular-nums sm:text-2xl">{nilai}</span>
      <span className={`mt-0.5 block text-xs ${aktif ? 'text-white/75' : 'text-suka-gray-500'}`}>{sub}</span>
    </>
  )
  const kelas = `rounded-2xl border px-4 py-3 text-left transition-colors ${
    aktif ? 'border-suka-brown bg-suka-brown text-white' : 'border-suka-brown/10 bg-white text-suka-ink'
  }`
  if (!onClick) return <div className={kelas}>{isi}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      className={`${kelas} ${aktif ? '' : 'hover:border-suka-brown/30'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-suka-orange`}
    >
      {isi}
    </button>
  )
}

/* ── Baris transaksi ──────────────────────────────────────────── */

function BarisTransaksi({
  t,
  tampilOutlet,
  onNota,
}: {
  t: PettyCashTransaction
  tampilOutlet: boolean
  onNota: (t: PettyCashTransaction) => void
}) {
  const masuk = t.type === 'in'
  return (
    <li className="grid grid-cols-[3rem_1.25rem_1fr] gap-x-2 py-3 sm:grid-cols-[3rem_1.25rem_1fr_auto] sm:gap-x-3">
      <div className="pt-0.5 text-right text-xs font-semibold tabular-nums text-suka-gray-500">{jamWib(t.transaction_date)}</div>
      <div className="relative flex justify-center pt-1.5">
        <span
          className={`relative z-10 h-2.5 w-2.5 rounded-full ring-4 ring-white ${masuk ? 'bg-emerald-500' : 'bg-red-500'}`}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-suka-ink">{labelKategori(t.category)}</span>
          <span className={`text-xs font-semibold ${masuk ? 'text-emerald-700' : 'text-red-700'}`}>
            {masuk ? 'Kas masuk' : 'Kas keluar'}
          </span>
        </div>
        {t.description && (
          <p className="mt-0.5 truncate text-sm text-suka-ink/75" title={t.description}>
            {t.description}
          </p>
        )}
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-suka-gray-500">
          {tampilOutlet && (
            <>
              <Building2 size={12} className="shrink-0 text-suka-orange" aria-hidden="true" />
              <span className="truncate">{t.outlet_name}</span>
              <span className="text-suka-gray-300" aria-hidden="true">/</span>
            </>
          )}
          <span className="truncate">{t.staff_name}</span>
        </p>
      </div>

      <div className="col-start-3 mt-1.5 flex items-center justify-between gap-3 sm:col-start-4 sm:row-start-1 sm:mt-0 sm:flex-col sm:items-end sm:justify-start sm:gap-1">
        <div className={`whitespace-nowrap text-sm font-bold tabular-nums ${masuk ? 'text-emerald-700' : 'text-suka-ink'}`}>
          {masuk ? '+' : '−'} {rupiah(t.amount)}
        </div>
        {t.receipt_url ? (
          <button
            type="button"
            onClick={() => onNota(t)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-suka-orange hover:bg-suka-orange/10 print:hidden"
          >
            <Receipt size={13} aria-hidden="true" /> Lihat nota
          </button>
        ) : masuk ? null : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
            <FileWarning size={13} aria-hidden="true" /> Tanpa nota
          </span>
        )}
      </div>
    </li>
  )
}

/* ── Halaman ──────────────────────────────────────────────────── */

export function PettyCashReportView({ transactions, selectedOutletId, onOutletChange }: PettyCashReportViewProps) {
  const [tipe, setTipe] = useState<TipeSaringan>('all')
  const [kategori, setKategori] = useState<string | null>(null)
  const [cari, setCari] = useState('')
  const [hanyaTanpaNota, setHanyaTanpaNota] = useState(false)
  const [batas, setBatas] = useState(BATAS_AWAL)
  const [nota, setNota] = useState<PettyCashTransaction | null>(null)

  const semuaOutlet = selectedOutletId === 'all'
  const dasarOutlet = useMemo(
    () => saring(transactions, { outletId: selectedOutletId, tipe: 'all', kategori: null, cari: '', hanyaTanpaNota: false }),
    [transactions, selectedOutletId],
  )
  const ringkasan = useMemo(() => ringkas(dasarOutlet), [dasarOutlet])
  const opsiKategori = useMemo(
    () => daftarKategori(tipe === 'all' ? dasarOutlet : dasarOutlet.filter((t) => t.type === tipe)),
    [dasarOutlet, tipe],
  )
  const tampil = useMemo(
    () => saring(transactions, { outletId: selectedOutletId, tipe, kategori, cari, hanyaTanpaNota }),
    [transactions, selectedOutletId, tipe, kategori, cari, hanyaTanpaNota],
  )
  const outletList = useMemo(() => perOutlet(saring(transactions, { outletId: 'all', tipe, kategori, cari, hanyaTanpaNota })), [
    transactions,
    tipe,
    kategori,
    cari,
    hanyaTanpaNota,
  ])
  const grup = useMemo(() => kelompokkanPerHari(tampil.slice(0, batas)), [tampil, batas])

  useEffect(() => setBatas(BATAS_AWAL), [selectedOutletId, tipe, kategori, cari, hanyaTanpaNota])
  useEffect(() => {
    if (kategori && !opsiKategori.some((k) => k.kategori === kategori)) setKategori(null)
  }, [kategori, opsiKategori])

  const pilihTipe = (t: TipeSaringan) => setTipe((lama) => (lama === t ? 'all' : t))
  const adaSaringan = tipe !== 'all' || kategori || cari || hanyaTanpaNota
  const resetSaringan = () => {
    setTipe('all')
    setKategori(null)
    setCari('')
    setHanyaTanpaNota(false)
  }
  const maxKeluar = Math.max(1, ...outletList.map((o) => o.keluar))

  return (
    <div className="space-y-5 pb-12">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="group" aria-label="Ringkasan dan saringan tipe">
        <KartuRingkas
          label="Kas masuk"
          nilai={rupiah(ringkasan.masuk)}
          sub={`${ringkasan.jumlahMasuk} modal & top up`}
          ikon={ArrowDownLeft}
          warna="text-emerald-600"
          aktif={tipe === 'in'}
          onClick={() => pilihTipe('in')}
        />
        <KartuRingkas
          label="Kas keluar"
          nilai={rupiah(ringkasan.keluar)}
          sub={`${ringkasan.jumlahKeluar} pengeluaran`}
          ikon={ArrowUpRight}
          warna="text-red-600"
          aktif={tipe === 'out'}
          onClick={() => pilihTipe('out')}
        />
        <KartuRingkas
          label="Selisih"
          nilai={rupiah(ringkasan.selisih)}
          sub="Masuk dikurangi keluar"
          ikon={Scale}
          warna={ringkasan.selisih >= 0 ? 'text-suka-orange' : 'text-red-600'}
        />
        <KartuRingkas
          label="Pengeluaran tanpa nota"
          nilai={String(ringkasan.tanpaNota)}
          sub={ringkasan.tanpaNota ? 'Ketuk untuk melihat' : 'Semua bernota'}
          ikon={FileWarning}
          warna={ringkasan.tanpaNota ? 'text-amber-600' : 'text-suka-gray-400'}
          aktif={hanyaTanpaNota}
          onClick={() => setHanyaTanpaNota((v) => !v)}
        />
      </div>

      <div className={`grid gap-5 ${semuaOutlet ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
        <div className="min-w-0 space-y-4">
          {/* Cari & kategori */}
          <div className="space-y-3 print:hidden">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400" />
              <input
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari keterangan, kategori, pembuat, atau outlet…"
                aria-label="Cari transaksi"
                className="w-full rounded-xl border border-suka-brown/15 bg-white py-2.5 pl-9 pr-3 text-sm text-suka-ink placeholder:text-suka-gray-400 focus:border-suka-orange focus:outline-none"
              />
            </div>
            {opsiKategori.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Saring menurut kategori">
                {[{ kategori: null as string | null, label: 'Semua kategori', jumlah: 0 }, ...opsiKategori].map((k) => {
                  const aktif = kategori === k.kategori
                  return (
                    <button
                      key={k.kategori ?? 'semua'}
                      type="button"
                      onClick={() => setKategori(k.kategori)}
                      aria-pressed={aktif}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        aktif
                          ? 'border-suka-orange bg-suka-orange/10 text-suka-brown'
                          : 'border-suka-brown/15 bg-white text-suka-gray-600 hover:border-suka-brown/40'
                      }`}
                    >
                      {k.label}
                      {k.kategori && <span className="tabular-nums opacity-60">{k.jumlah}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-suka-gray-500">
            <span>
              <span className="font-semibold text-suka-ink">{tampil.length}</span> transaksi
              {adaSaringan ? ' sesuai saringan' : ''}
            </span>
            {adaSaringan && (
              <button type="button" onClick={resetSaringan} className="font-semibold text-suka-orange hover:underline print:hidden">
                Hapus saringan
              </button>
            )}
          </div>

          {/* Garis waktu per hari */}
          {grup.length === 0 ? (
            <p className="rounded-2xl border border-suka-brown/10 bg-white py-16 text-center text-sm font-medium text-suka-gray-500">
              {transactions.length === 0 ? 'Belum ada transaksi petty cash di periode ini.' : 'Tidak ada transaksi yang sesuai saringan.'}
            </p>
          ) : (
            <div className="space-y-4">
              {grup.map((g) => (
                <section key={g.tanggal} className="overflow-hidden rounded-2xl border border-suka-brown/10 bg-white break-inside-avoid">
                  <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-suka-brown/5 bg-suka-cream/50 px-4 py-2.5">
                    <h3 className="font-display text-lg text-suka-brown">{g.label}</h3>
                    <p className="flex flex-wrap gap-x-3 text-xs text-suka-gray-500 tabular-nums">
                      {g.ringkasan.masuk > 0 && (
                        <span>
                          Masuk <span className="font-semibold text-emerald-700">{rupiah(g.ringkasan.masuk)}</span>
                        </span>
                      )}
                      {g.ringkasan.keluar > 0 && (
                        <span>
                          Keluar <span className="font-semibold text-suka-ink">{rupiah(g.ringkasan.keluar)}</span>
                        </span>
                      )}
                      <span>{g.baris.length} transaksi</span>
                    </p>
                  </header>
                  <div className="relative px-3 sm:px-4">
                    <span
                      className="pointer-events-none absolute bottom-3 top-3 w-px bg-suka-brown/10 left-[calc(0.75rem+3rem+0.5rem+0.625rem)] sm:left-[calc(1rem+3rem+0.75rem+0.625rem)]"
                      aria-hidden="true"
                    />
                    <ul className="divide-y divide-suka-brown/5">
                      {g.baris.map((t) => (
                        <BarisTransaksi key={t.id} t={t} tampilOutlet={semuaOutlet} onNota={setNota} />
                      ))}
                    </ul>
                  </div>
                </section>
              ))}
              {tampil.length > batas && (
                <button
                  type="button"
                  onClick={() => setBatas((b) => b + BATAS_AWAL)}
                  className="w-full rounded-xl border border-suka-brown/15 bg-white py-2.5 text-sm font-semibold text-suka-brown hover:border-suka-brown/40 print:hidden"
                >
                  Tampilkan {Math.min(BATAS_AWAL, tampil.length - batas)} lagi ({tampil.length - batas} tersisa)
                </button>
              )}
            </div>
          )}
        </div>

        {/* Per outlet: hanya saat Semua Cabang */}
        {semuaOutlet && outletList.length > 0 && (
          <aside className="h-fit space-y-2 rounded-2xl border border-suka-brown/10 bg-white p-4 xl:sticky xl:top-20">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-lg text-suka-brown">Per outlet</h3>
              <span className="text-xs text-suka-gray-500">{outletList.length} outlet</span>
            </div>
            <p className="text-xs text-suka-gray-500">Kas keluar terbesar. Ketuk untuk melihat satu outlet.</p>
            <ul className="space-y-1">
              {outletList.map((o) => (
                <li key={o.outletId}>
                  <button
                    type="button"
                    onClick={() => onOutletChange(o.outletId)}
                    className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-suka-cream/70"
                  >
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-semibold text-suka-ink">{o.nama}</span>
                      <span className="shrink-0 tabular-nums text-suka-ink">{rupiah(o.keluar)}</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-suka-cream" aria-hidden="true">
                      <span className="block h-full rounded-full bg-suka-orange" style={{ width: `${(o.keluar / maxKeluar) * 100}%` }} />
                    </span>
                    <span className="mt-0.5 block text-[11px] text-suka-gray-500">
                      {o.jumlahKeluar} pengeluaran{o.masuk > 0 ? ` · masuk ${rupiah(o.masuk)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <NotaModal tx={nota} onClose={() => setNota(null)} />
    </div>
  )
}
