'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, Clock, History, Info, Receipt, Search, Store, UserRound } from 'lucide-react'
import { formatWib } from '@/lib/timezone'
import { getPromoStatus } from '@/lib/promoSchedule'
import { LEGACY_REWARD_MENU_NAME } from '@/lib/promoReward'
import { susunRiwayatPromo, type AlasanSelesai, type PemakaianMap, type RiwayatEntry, type RiwayatRow } from '@/lib/promoRiwayat'
import { StatusBadge, promoRule } from './promoParts'
import type { OutletPromo } from './promoTypes'

type Filter = 'semua' | 'aktif' | 'selesai'

const ALASAN_LABEL: Record<AlasanSelesai, string> = {
  dimatikan: 'Dimatikan',
  dilepas: 'Outlet dilepas dari promo',
  dihapus: 'Dihapus',
  diubah: 'Diganti pengaturan baru',
  jadwal_selesai: 'Jadwal selesai',
}

export default function PromoRiwayat({
  rows,
  pemakaian,
  menuNames,
  outletNames,
  staffNames,
  now,
  error,
}: {
  rows: RiwayatRow[]
  pemakaian: PemakaianMap
  menuNames: Record<string, string>
  outletNames: Record<string, string>
  staffNames: Record<string, string>
  now: number
  error?: string | null
}) {
  const [filter, setFilter] = useState<Filter>('semua')
  const [query, setQuery] = useState('')
  const [outletId, setOutletId] = useState('')

  const entries = useMemo(() => susunRiwayatPromo(rows, pemakaian, now), [rows, pemakaian, now])

  const outletOptions = useMemo(() => {
    const ids = new Set(entries.flatMap(e => e.outletIds))
    return [...ids].map(id => ({ id, name: outletNames[id] || 'Outlet tidak dikenal' })).sort((a, b) => a.name.localeCompare(b.name, 'id'))
  }, [entries, outletNames])

  const judulOf = (e: RiwayatEntry) => {
    const rewardName = e.konfigurasi.reward_menu_item_id ? menuNames[e.konfigurasi.reward_menu_item_id] || 'menu gratis' : LEGACY_REWARD_MENU_NAME
    const aturan = promoRule(e.konfigurasi as OutletPromo, rewardName)
    return { nama: String(e.konfigurasi.promo_name || '').trim(), aturan }
  }
  const sasaranOf = (e: RiwayatEntry) => (e.scope === 'global' ? 'Semua menu' : menuNames[e.menuItemId || ''] || 'Menu sudah dihapus')

  const keyword = query.trim().toLowerCase()
  const visible = entries.filter(e => {
    if (filter !== 'semua' && e.status !== filter) return false
    if (outletId && !e.outletIds.includes(outletId)) return false
    if (keyword) {
      const { nama, aturan } = judulOf(e)
      const teks = `${nama} ${aturan} ${sasaranOf(e)}`.toLowerCase()
      if (!teks.includes(keyword)) return false
    }
    return true
  })
  const aktif = visible.filter(e => e.status === 'aktif')
  const selesai = visible.filter(e => e.status === 'selesai')

  return (
    <section aria-label="Riwayat promo" className="space-y-4">
      <div>
        <h2 className="font-display text-2xl tracking-wide text-suka-brown">Riwayat promo</h2>
        <p className="mt-1 text-sm text-slate-500">Semua promo yang sedang aktif dan yang sudah tidak aktif, dengan tanggal &amp; jam berlakunya (WIB).</p>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-xs font-medium text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <span>
          Jam nyala/mati tercatat pasti mulai 30 Okt 2026. Promo yang lebih lama bertanda <b>≈ perkiraan</b>: waktunya disusun dari tanggal promo dibuat
          dan waktu transaksi pertama–terakhir yang memakainya.
        </span>
      </p>

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">Riwayat gagal dimuat: {error}</p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari nama promo atau menu..."
            aria-label="Cari riwayat promo"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/15"
          />
        </div>
        <select
          value={outletId}
          onChange={e => setOutletId(e.target.value)}
          aria-label="Saring outlet"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-suka-orange"
        >
          <option value="">Semua outlet</option>
          {outletOptions.map(o => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <div role="radiogroup" aria-label="Saring status" className="flex gap-1 rounded-2xl bg-slate-100 p-1">
          {([
            ['semua', 'Semua'],
            ['aktif', 'Sedang aktif'],
            ['selesai', 'Tidak aktif'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-[40px] flex-1 cursor-pointer whitespace-nowrap rounded-xl px-3.5 text-xs font-bold transition-colors lg:flex-none ${
                filter === value ? 'bg-white text-suka-brown shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <History className="mx-auto h-6 w-6 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-500">Tidak ada promo yang cocok.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {aktif.length > 0 && (
            <Kelompok judul="Sedang aktif" jumlah={aktif.length}>
              {aktif.map(e => (
                <KartuRiwayat key={e.id} entry={e} judul={judulOf(e)} sasaran={sasaranOf(e)} outletNames={outletNames} staffNames={staffNames} now={now} />
              ))}
            </Kelompok>
          )}
          {selesai.length > 0 && (
            <Kelompok judul="Sudah tidak aktif" jumlah={selesai.length}>
              {selesai.map(e => (
                <KartuRiwayat key={e.id} entry={e} judul={judulOf(e)} sasaran={sasaranOf(e)} outletNames={outletNames} staffNames={staffNames} now={now} />
              ))}
            </Kelompok>
          )}
        </div>
      )}
    </section>
  )
}

function Kelompok({ judul, jumlah, children }: { judul: string; jumlah: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-500">
        {judul}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{jumlah}</span>
      </h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function KartuRiwayat({
  entry,
  judul,
  sasaran,
  outletNames,
  staffNames,
  now,
}: {
  entry: RiwayatEntry
  judul: { nama: string; aturan: string }
  sasaran: string
  outletNames: Record<string, string>
  staffNames: Record<string, string>
  now: number
}) {
  const aktif = entry.status === 'aktif'
  const status = aktif ? getPromoStatus({ ...entry.konfigurasi, is_active: true }, now) : null
  const namaOutlet = entry.outletIds.map(id => outletNames[id] || 'Outlet tidak dikenal').sort((a, b) => a.localeCompare(b, 'id'))
  const perkiraan = entry.perkiraan ? '≈ ' : ''
  const cfg = entry.konfigurasi
  const punyaJadwal = cfg.start_date || cfg.end_date
  const jamHarian = cfg.daily_start_time && cfg.daily_end_time ? `${String(cfg.daily_start_time).slice(0, 5)}–${String(cfg.daily_end_time).slice(0, 5)} WIB tiap hari` : null
  const pelaku = entry.alasanSelesai && entry.alasanSelesai !== 'jadwal_selesai' && !entry.perkiraan
    ? entry.diubahOleh
      ? staffNames[entry.diubahOleh] || 'Pengguna lain'
      : 'Sistem (mis. kuota habis)'
    : null

  return (
    <article className={`rounded-2xl bg-white p-4 shadow-sm ring-1 sm:p-5 ${aktif ? 'ring-2 ring-emerald-400/70' : 'ring-slate-200/70'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{sasaran}</p>
          <h4 className="font-display text-lg leading-tight tracking-wide text-suka-brown">{judul.nama || judul.aturan}</h4>
          {judul.nama && <p className="text-xs font-bold text-slate-600">{judul.aturan}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {status && <StatusBadge status={status} />}
          {!aktif && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {entry.alasanSelesai ? ALASAN_LABEL[entry.alasanSelesai] : entry.dipakai > 0 ? 'Tidak aktif' : 'Tidak aktif · tak pernah dipakai'}
            </span>
          )}
          {entry.perkiraan && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">≈ perkiraan</span>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <Baris icon={<Clock className="h-3.5 w-3.5" />} label={entry.perkiraan && entry.selesai === null && !aktif ? 'Dibuat' : 'Mulai berlaku'}>
          {entry.mulai ? `${perkiraan}${formatWib(entry.mulai)}` : '-'}
        </Baris>
        <Baris icon={<Clock className="h-3.5 w-3.5" />} label="Berhenti">
          {aktif ? <span className="font-bold text-emerald-700">Masih aktif</span> : entry.selesai ? `${perkiraan}${formatWib(entry.selesai)}` : '-'}
        </Baris>
        {(punyaJadwal || jamHarian) && (
          <Baris icon={<CalendarClock className="h-3.5 w-3.5" />} label="Jadwal promo">
            {punyaJadwal && `${cfg.start_date ? formatWib(cfg.start_date) : 'sejak dinyalakan'} – ${cfg.end_date ? formatWib(cfg.end_date) : 'tanpa batas'}`}
            {punyaJadwal && jamHarian && ' · '}
            {jamHarian}
          </Baris>
        )}
        <Baris icon={<Receipt className="h-3.5 w-3.5" />} label="Dipakai">
          {entry.dipakai > 0
            ? `${entry.dipakai.toLocaleString('id-ID')} transaksi · ${formatWib(entry.pakaiPertama)} s.d. ${formatWib(entry.pakaiTerakhir)}`
            : 'Belum pernah'}
        </Baris>
        {pelaku && (
          <Baris icon={<UserRound className="h-3.5 w-3.5" />} label="Dihentikan oleh">
            {pelaku}
          </Baris>
        )}
        <Baris icon={<Store className="h-3.5 w-3.5" />} label={`Outlet (${namaOutlet.length})`} wide>
          {namaOutlet.length > 0 ? namaOutlet.join(', ') : '-'}
        </Baris>
      </dl>
    </article>
  )
}

function Baris({ icon, label, children, wide = false }: { icon: React.ReactNode; label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`flex items-start gap-2 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="font-semibold text-slate-700">{children}</dd>
      </div>
    </div>
  )
}
