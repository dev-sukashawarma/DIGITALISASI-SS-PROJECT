'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, RefreshCw, Info, FileDown, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@suka/auth'
import { rupiah } from '@/lib/format'
import { itemFlags, type EomChannel, type CashOutletRow } from '@/lib/eom/kasir'
import { type KasirResponse, SETORAN_WAJIB_MULAI, AMBANG_MERAH } from './types'

const tgl = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}
const dayBefore = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`)
  x.setUTCDate(x.getUTCDate() - 1)
  return x.toISOString().slice(0, 10)
}
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—')

export default function KasirTab({ month, year }: { month: number; year: number }) {
  const { outletStaff } = useAuth()
  const [printing, setPrinting] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const q = useQuery<KasirResponse>({
    queryKey: ['eom-kasir', year, month],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/eom-closing/kasir?month=${month}&year=${year}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      return json
    },
  })

  if (q.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white rounded-2xl border border-suka-gray-200">
        <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-suka-brown">Menghitung data kasir sebulan…</p>
        <p className="text-xs text-suka-gray-500">Mengambil seluruh order bulan ini — bisa sampai 1 menit.</p>
      </div>
    )
  }
  if (q.error || !q.data) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm flex items-center justify-between gap-4">
        <span>Gagal memuat data kasir: {(q.error as Error)?.message}</span>
        <button onClick={() => q.refetch()} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold">Coba lagi</button>
      </div>
    )
  }

  const d = q.data
  const handlePdf = async () => {
    setPrinting(true)
    try {
      // Rincian per outlet diambil saat PDF dibuat saja (payload besar).
      const res = await fetch(`/api/eom-closing/kasir?month=${month}&year=${year}&detail=outlet`, { cache: 'no-store' })
      const full = await res.json()
      if (!res.ok || full.error) throw new Error(full.error || `HTTP ${res.status}`)
      const { generateKasirEomPdf } = await import('./exportEomPdf')
      await generateKasirEomPdf(full, outletStaff?.name ?? 'Finance')
      toast.success('PDF rincian Kasir & Kas Toko diunduh')
    } catch (e) {
      console.error(e)
      toast.error('Gagal membuat PDF')
    } finally {
      setPrinting(false)
    }
  }

  const handleExcel = async () => {
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/eom-closing/kasir?month=${month}&year=${year}&detail=outlet`, { cache: 'no-store' })
      const full = await res.json()
      if (!res.ok || full.error) throw new Error(full.error || `HTTP ${res.status}`)
      const { generateKasirExcel } = await import('./exportKasirExcel')
      await generateKasirExcel(full, outletStaff?.name ?? 'Finance')
      toast.success('Workbook Excel Kasir & Kas Toko berhasil diunduh')
    } catch (e: any) {
      console.error(e)
      toast.error('Gagal membuat Excel: ' + (e?.message || 'Error'))
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-suka-gray-500">
        <span>Data per {new Date(d.fetchedAt).toLocaleString('id-ID')} · {d.kpi.totalOrders.toLocaleString('id-ID')} order selesai</span>
        <div className="flex items-center gap-2">
          <button onClick={() => q.refetch()} disabled={q.isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-suka-gray-200 bg-white font-bold text-suka-brown hover:bg-suka-cream disabled:opacity-50">
            <RefreshCw size={12} className={q.isFetching ? 'animate-spin' : ''} /> Tarik ulang
          </button>
          <button onClick={handleExcel} disabled={exportingExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600 bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50">
            <Download size={12} /> {exportingExcel ? 'Menyiapkan Excel…' : 'Ekspor Excel (.xlsx)'}
          </button>
          <button onClick={handlePdf} disabled={printing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-suka-brown text-white font-bold hover:opacity-90 disabled:opacity-50">
            <FileDown size={12} /> {printing ? 'Menyiapkan PDF (±10 dtk)…' : 'Unduh PDF Rincian'}
          </button>
        </div>
      </div>
      <KpiSection d={d} />
      <SetoranSection rows={d.cash} period={d.period} konfirmasi={d.konfirmasiSetoran} />
      <ChannelSection d={d} />
    </div>
  )
}

function KpiSection({ d }: { d: KasirResponse }) {
  const sum = (f: (c: EomChannel) => number) => d.channels.reduce((s, c) => s + f(c), 0)
  const checks = [
    { label: 'Omzet kotor', report: d.kpi.grossRevenue, table: sum((c) => c.revenue) },
    { label: 'Potongan', report: d.kpi.totalDeductions, table: sum((c) => c.potongan) },
    { label: 'HPP', report: d.kpi.totalHPP, table: sum((c) => c.hppA + c.hppB) },
  ]
  const mismatches = checks.filter((c) => Math.abs(c.report - c.table) >= 1)

  const cards = [
    { label: 'Omzet Kotor', value: d.kpi.grossRevenue },
    { label: 'Potongan (promo/diskon)', value: d.kpi.totalDeductions },
    { label: 'Total HPP', value: d.kpi.totalHPP },
    { label: 'Laba Kotor', value: d.kpi.grossProfit, strong: true },
  ]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border p-4 shadow-sm ${c.strong ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-suka-gray-200'}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-suka-gray-500">{c.label}</p>
            <p className={`mt-1 text-lg font-black ${c.strong ? 'text-emerald-700' : 'text-suka-brown'}`}>{rupiah(c.value)}</p>
          </div>
        ))}
      </div>
      {mismatches.length === 0 ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
          <CheckCircle2 size={14} /> Angka sama dengan Rangkuman Penjualan (Semua Cabang, Semua Channel) untuk bulan ini — tabel channel di bawah menjumlah tepat ke kartu di atas.
        </p>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
          <p className="font-bold flex items-center gap-2"><AlertTriangle size={14} /> Jumlah tabel channel berbeda dari kartu Rangkuman Penjualan:</p>
          {mismatches.map((m) => (
            <p key={m.label}>{m.label}: kartu {rupiah(m.report)} · tabel {rupiah(m.table)} · selisih {rupiah(m.table - m.report)}</p>
          ))}
          <p className="text-amber-700">Biasanya karena order berstatus "settled" (kartu menghitung status "completed" saja). Laporkan ke developer bila selisihnya besar.</p>
        </div>
      )}
    </div>
  )
}

function SetoranSection({ rows, period, konfirmasi }: { rows: CashOutletRow[]; period: KasirResponse['period']; konfirmasi: KasirResponse['konfirmasiSetoran'] }) {
  // Setoran dinilai bila pencatatan wajib sudah berlaku ATAU ada konfirmasi manual Admin Finance.
  const setoranDinilai = period.from >= SETORAN_WAJIB_MULAI || !!konfirmasi
  const total = rows.reduce(
    (a, r) => ({
      omzetTunai: a.omzetTunai + r.omzetTunai,
      shiftFisik: a.shiftFisik + r.shiftFisik,
      selisihKasir: a.selisihKasir + r.selisihKasir,
      luarShift: a.luarShift + (r.omzetTunai - r.shiftExpected),
      setoran: a.setoran + r.setoranDiterima,
      belumTutup: a.belumTutup + r.shiftBelumTutup,
    }),
    { omzetTunai: 0, shiftFisik: 0, selisihKasir: 0, luarShift: 0, setoran: 0, belumTutup: 0 },
  )
  const merah = (r: CashOutletRow) =>
    Math.abs(r.selisihKasir) > AMBANG_MERAH ||
    r.shiftBelumTutup > 0 ||
    (setoranDinilai && Math.abs(r.shiftFisik - r.setoranDiterima) > AMBANG_MERAH)

  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-suka-gray-100">
        <h3 className="font-black text-suka-brown">1. Setoran Omzet Tunai per Outlet</h3>
        <p className="text-xs text-suka-gray-500 mt-0.5">
          Omzet tunai POS → uang laci saat tutup shift → setoran diterima kantor. Petty cash tidak ikut disetor.
        </p>
        {konfirmasi ? (
          <p className="mt-2 flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span>
              Setoran <b>{konfirmasi.label}</b> sudah <b>dikonfirmasi valid oleh Admin Finance</b> — dihitung sudah disetor.
              Setoran penjualan sesudahnya diambil dari catatan tab Setoran.
            </span>
          </p>
        ) : !setoranDinilai && (
          <p className="mt-2 flex items-start gap-2 text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg p-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            Bulan ini dinilai dari tutup shift saja. Kolom setoran kantor hanya informasi; mulai Oktober selisih setoran ikut dinilai.
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-suka-cream/60 text-[10px] uppercase text-suka-gray-600">
            <tr>
              <th className="py-2.5 px-3 text-left">Outlet</th>
              <th className="py-2.5 px-3 text-right">Omzet tunai POS</th>
              <th className="py-2.5 px-3 text-right">Uang laci (tutup shift)</th>
              <th className="py-2.5 px-3 text-right">Selisih kasir</th>
              <th className="py-2.5 px-3 text-right" title="Omzet tunai POS di luar jam shift yang tercatat">Tunai di luar shift</th>
              <th className="py-2.5 px-3 text-center">Shift</th>
              <th className="py-2.5 px-3 text-right">Sudah disetor</th>
              <th className="py-2.5 px-3 text-right">Belum disetor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100">
            {rows.map((r) => {
              const luarShift = r.omzetTunai - r.shiftExpected
              const belumSetor = r.shiftFisik - r.setoranDiterima
              return (
                <tr key={r.outletId} className={merah(r) ? 'bg-red-50/70' : 'hover:bg-amber-50/30'}>
                  <td className="py-2.5 px-3 font-bold text-suka-brown">
                    {r.outletName.replace('SUKA SHAWARMA ', '')}
                    {r.outletType === 'mitra' && <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">MITRA</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">{rupiah(r.omzetTunai)}</td>
                  <td className="py-2.5 px-3 text-right">{rupiah(r.shiftFisik)}</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${r.selisihKasir < 0 ? 'text-red-700' : r.selisihKasir > 0 ? 'text-amber-700' : 'text-suka-gray-400'}`}>
                    {r.selisihKasir === 0 ? '0' : `${r.selisihKasir > 0 ? '+' : ''}${rupiah(r.selisihKasir)}`}
                  </td>
                  <td className={`py-2.5 px-3 text-right ${Math.abs(luarShift) >= 1 ? 'text-amber-700 font-semibold' : 'text-suka-gray-400'}`}>
                    {Math.abs(luarShift) >= 1 ? rupiah(luarShift) : '0'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {r.shiftCount}
                    {r.shiftBelumTutup > 0 && <span className="ml-1 text-red-700 font-bold">({r.shiftBelumTutup} belum tutup)</span>}
                    {r.shiftBerjalan > 0 && <span className="ml-1 text-suka-gray-400">({r.shiftBerjalan} berjalan)</span>}
                  </td>
                  <td className={`py-2.5 px-3 text-right ${setoranDinilai ? '' : 'text-suka-gray-400'}`}>
                    {r.setoranDiterima > 0 ? rupiah(r.setoranDiterima) : '—'}
                    {r.setoranTerkonfirmasi > 0 && (
                      <div className="text-[10px] text-emerald-700 font-semibold">✓ {rupiah(r.setoranTerkonfirmasi)} dikonfirmasi</div>
                    )}
                    {r.setoranCount > 0 && (
                      <div className="text-[10px] text-suka-gray-500">+ {rupiah(r.setoranSistem)} tercatat ({r.setoranCount}x)</div>
                    )}
                  </td>
                  <td className={`py-2.5 px-3 text-right ${setoranDinilai && Math.abs(belumSetor) > AMBANG_MERAH ? 'text-red-700 font-bold' : ''}`}>
                    {!setoranDinilai ? '—' : Math.abs(belumSetor) < 1
                      ? <span className="text-emerald-700 font-bold">✓ Lunas</span>
                      : rupiah(belumSetor)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-amber-50 font-black text-suka-brown border-t-2 border-suka-brown">
            <tr>
              <td className="py-2.5 px-3">TOTAL</td>
              <td className="py-2.5 px-3 text-right">{rupiah(total.omzetTunai)}</td>
              <td className="py-2.5 px-3 text-right">{rupiah(total.shiftFisik)}</td>
              <td className="py-2.5 px-3 text-right">{total.selisihKasir > 0 ? '+' : ''}{rupiah(total.selisihKasir)}</td>
              <td className="py-2.5 px-3 text-right">{rupiah(total.luarShift)}</td>
              <td className="py-2.5 px-3 text-center">{total.belumTutup > 0 ? `${total.belumTutup} belum tutup` : ''}</td>
              <td className="py-2.5 px-3 text-right">{rupiah(total.setoran)}</td>
              <td className="py-2.5 px-3 text-right">{setoranDinilai ? rupiah(total.shiftFisik - total.setoran) : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-5 py-3 text-[11px] text-suka-gray-500 border-t border-suka-gray-100">
        Baris merah: selisih kasir lebih dari {rupiah(AMBANG_MERAH)}, ada shift hari sebelumnya yang belum ditutup{setoranDinilai ? ', atau setoran kurang/lebih dari uang laci' : ''}. Shift hari ini yang masih berjalan tidak dihitung.
      </p>
    </div>
  )
}

function ChannelSection({ d }: { d: KasirResponse }) {
  const cut = d.hppCutoff
  const labelA = cut ? `HPP ${tgl(d.period.from)}–${tgl(dayBefore(cut))}` : 'HPP'
  const labelB = cut ? `HPP ${tgl(cut)}–${tgl(d.period.to)}` : null
  const totals = useMemo(() => d.channels.reduce(
    (a, c) => ({ revenue: a.revenue + c.revenue, potongan: a.potongan + c.potongan, hppA: a.hppA + c.hppA, hppB: a.hppB + c.hppB, laba: a.laba + c.labaKotor }),
    { revenue: 0, potongan: 0, hppA: 0, hppB: 0, laba: 0 },
  ), [d.channels])
  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-suka-gray-100">
        <h3 className="font-black text-suka-brown">2. Omzet, Potongan & HPP per Channel</h3>
        <p className="text-xs text-suka-gray-500 mt-0.5">
          Rumus sama dengan Rangkuman Penjualan. HPP mengikuti tanggal order
          {cut ? ` — dipecah di ${tgl(cut)} karena ada pergantian HPP.` : '.'} Rincian menu per channel ada di PDF.
        </p>
        {d.hppPerubahan.length > 1 && (
          <p className="mt-1 text-[11px] text-amber-700">
            Ada beberapa tanggal perubahan HPP bulan ini: {d.hppPerubahan.map(([t, n]) => `${tgl(t)} (${n})`).join(', ')}.
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-suka-cream/60 text-[10px] uppercase text-suka-gray-600">
            <tr>
              <th className="py-2.5 px-3 text-left">Channel</th>
              <th className="py-2.5 px-3 text-right">Omzet kotor</th>
              <th className="py-2.5 px-3 text-right">Potongan</th>
              <th className="py-2.5 px-3 text-right">{labelA}</th>
              {labelB && <th className="py-2.5 px-3 text-right">{labelB}</th>}
              <th className="py-2.5 px-3 text-right">Laba kotor</th>
              <th className="py-2.5 px-3 text-right">Food cost</th>
              <th className="py-2.5 px-3 text-center" title="Rekonsiliasi platform oleh Hermes">Hermes</th>
              <th className="py-2.5 px-3 text-center">Cek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100">
            {d.channels.map((c) => {
              const flagged = c.items.filter((i) => itemFlags(i, !!cut).length > 0).length
              return (
                  <tr key={c.key} className="hover:bg-amber-50/40">
                    <td className="py-2.5 px-3 font-bold text-suka-brown">{c.label}</td>
                    <td className="py-2.5 px-3 text-right">{rupiah(c.revenue)}</td>
                    <td className="py-2.5 px-3 text-right">{rupiah(c.potongan)}</td>
                    <td className="py-2.5 px-3 text-right">{rupiah(c.hppA)}</td>
                    {labelB && <td className="py-2.5 px-3 text-right">{rupiah(c.hppB)}</td>}
                    <td className={`py-2.5 px-3 text-right font-bold ${c.labaKotor >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{rupiah(c.labaKotor)}</td>
                    <td className="py-2.5 px-3 text-right">{pct(c.hppA + c.hppB, c.revenue)}</td>
                    <td className="py-2.5 px-3 text-center text-[10px] text-suka-gray-400">menunggu</td>
                    <td className="py-2.5 px-3 text-center">
                      {flagged > 0
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800" title="Menu dengan HPP kosong / tidak berubah — lihat PDF">{flagged} menu</span>
                        : <CheckCircle2 size={14} className="inline text-emerald-600" />}
                    </td>
                  </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-amber-50 font-black text-suka-brown border-t-2 border-suka-brown">
            <tr>
              <td className="py-2.5 px-3">TOTAL</td>
              <td className="py-2.5 px-3 text-right">{rupiah(totals.revenue)}</td>
              <td className="py-2.5 px-3 text-right">{rupiah(totals.potongan)}</td>
              <td className="py-2.5 px-3 text-right">{rupiah(totals.hppA)}</td>
              {labelB && <td className="py-2.5 px-3 text-right">{rupiah(totals.hppB)}</td>}
              <td className="py-2.5 px-3 text-right">{rupiah(totals.laba)}</td>
              <td className="py-2.5 px-3 text-right">{pct(totals.hppA + totals.hppB, totals.revenue)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-5 py-3 text-[11px] text-suka-gray-500 border-t border-suka-gray-100">
        Kolom Hermes akan terisi setelah Hermes mengirim rekap settlement harian (GoFood, GrabFood, ShopeeFood, TikTok GO) — tampil sebagai pembanding, tidak mengubah angka di atas.
      </p>
    </div>
  )
}
