'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Info, RefreshCw } from 'lucide-react'
import { useOutletScope } from '@/hooks/useOutletScope'
import { useHPPDinamis } from '@/hooks/useHPPDinamis'
import {
  ringkasHppDinamis, selisihPct, periodeSebelumSnapshot, LABEL_SUMBER, SUMBER_URUT,
  TANGGAL_MULAI_SNAPSHOT,
} from '@/lib/stok/hppDinamis'

const rp = (v: number | null | undefined) =>
  v == null ? '—' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const pct = (v: number | null) => (v == null ? 'N/A' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)

function awalBulan(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function hariIni(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function HPPDinamisPanel() {
  const { boundOutlets, selectedOutletId } = useOutletScope()
  const [outletId, setOutletId] = useState<string | null>(selectedOutletId)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    if (outletId == null && selectedOutletId) setOutletId(selectedOutletId)
  }, [selectedOutletId, outletId])

  useEffect(() => {
    setFrom(awalBulan())
    setTo(hariIni())
  }, [])

  const { data, isLoading, isFetching, error, refetch } = useHPPDinamis(outletId, from, to)

  const ringkas = useMemo(() => (data ? ringkasHppDinamis(data.menu, data.bahan) : null), [data])

  return (
    <section className="mt-10 rounded-2xl border border-suka-brown/10 bg-white p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black text-suka-brown">HPP Dinamis (pembanding)</h2>
          <p className="text-xs text-suka-brown/60">
            Harga mengikuti kiriman gudang terakhir ke outlet. <b>Pelaporan resmi tetap memakai HPP override.</b>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Pilih outlet"
            className="rounded-lg border border-suka-brown/20 px-2 py-1.5 text-sm"
            value={outletId ?? ''}
            onChange={(e) => setOutletId(e.target.value || null)}
          >
            <option value="">Pilih outlet…</option>
            {boundOutlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <input type="date" aria-label="Tanggal mulai" className="rounded-lg border border-suka-brown/20 px-2 py-1.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-suka-brown/50">s/d</span>
          <input type="date" aria-label="Tanggal akhir" className="rounded-lg border border-suka-brown/20 px-2 py-1.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" onClick={() => refetch()} className="rounded-lg border border-suka-brown/20 p-2" aria-label="Muat ulang">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {periodeSebelumSnapshot(from) && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Harga kiriman belum tersedia sebelum {TANGGAL_MULAI_SNAPSHOT}. HPP periode ini memakai harga master, bukan kiriman.</span>
        </div>
      )}

      {!outletId && <p className="mt-6 text-sm text-suka-brown/60">Pilih outlet untuk mulai.</p>}
      {error && <p className="mt-6 text-sm text-red-700">{error instanceof Error ? error.message : String(error)}</p>}
      {outletId && isLoading && <p className="mt-6 text-sm text-suka-brown/60">Menghitung…</p>}

      {data && ringkas && (
        <>
          {/* Ringkasan outlet */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="HPP Override (laporan)" value={rp(ringkas.totalOverride)} />
            <Tile label="HPP Teoritis dinamis" value={rp(ringkas.totalTeoritis)} sub={`vs override menu ber-resep: ${pct(ringkas.selisihTeoritisVsOverridePct)}`} />
            <Tile label="HPP Aktual (ledger pemakaian)" value={rp(ringkas.totalAktual)} sub={`vs teoritis: ${pct(ringkas.selisihAktualVsTeoritisPct)}`} />
            <Tile label="Menu tanpa resep" value={String(ringkas.menuTanpaResep)} sub="hanya override" />
          </div>

          {/* Porsi sumber harga */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {SUMBER_URUT.map((s) => (
              <span key={s} className={`rounded-full px-2.5 py-1 ${s === 'tidak_ada' && ringkas.porsi[s] > 0 ? 'bg-red-100 text-red-800' : 'bg-suka-cream text-suka-brown'}`}>
                {LABEL_SUMBER[s]}: {ringkas.porsi[s].toFixed(0)}%
              </span>
            ))}
            <span className="inline-flex items-center gap-1 text-suka-brown/50"><Info className="h-3 w-3" /> porsi dari nilai HPP aktual</span>
          </div>

          {/* Per menu */}
          <h3 className="mt-8 text-sm font-bold text-suka-brown">Per menu (teoritis: resep × harga efektif outlet)</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-suka-brown/60">
                <tr><th className="py-1 pr-3">Menu</th><th className="pr-3 text-right">Terjual</th><th className="pr-3 text-right">Override/unit</th><th className="pr-3 text-right">Dinamis/unit</th><th className="pr-3 text-right">Selisih</th><th className="pr-3 text-right">Override total</th><th className="text-right">Dinamis total</th></tr>
              </thead>
              <tbody>
                {data.menu.map((m) => (
                  <tr key={m.menu_item_id} className="border-t border-suka-brown/5">
                    <td className="py-1.5 pr-3">{m.menu_nama}{!m.punya_resep && <span className="ml-1 text-[10px] text-suka-brown/40">(tanpa resep)</span>}</td>
                    <td className="pr-3 text-right">{m.qty_terjual}</td>
                    <td className="pr-3 text-right">{rp(m.hpp_override_unit)}</td>
                    <td className="pr-3 text-right">{rp(m.hpp_teoritis_unit)}</td>
                    <td className="pr-3 text-right">{m.punya_resep && m.hpp_teoritis_unit != null ? pct(selisihPct(m.hpp_teoritis_unit, m.hpp_override_unit)) : '—'}</td>
                    <td className="pr-3 text-right">{rp(m.hpp_override_total)}</td>
                    <td className="text-right">{rp(m.hpp_teoritis_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per bahan */}
          <h3 className="mt-8 text-sm font-bold text-suka-brown">Per bahan (aktual: ledger pemakaian × harga efektif)</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-suka-brown/60">
                <tr><th className="py-1 pr-3">Bahan</th><th className="pr-3 text-right">Qty pemakaian</th><th className="pr-3">Sumber harga</th><th className="pr-3">Ref terakhir</th><th className="text-right">Nilai</th></tr>
              </thead>
              <tbody>
                {data.bahan.map((b) => (
                  <tr key={b.bahan_baku_id} className="border-t border-suka-brown/5">
                    <td className="py-1.5 pr-3">{b.nama_bahan}</td>
                    <td className="pr-3 text-right">{b.qty_pemakaian.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {b.is_gram ? (b.satuan_kecil ?? '') : b.satuan}</td>
                    <td className="pr-3"><span className={b.sumber_harga_terakhir === 'tidak_ada' ? 'text-red-700 font-semibold' : ''}>{LABEL_SUMBER[b.sumber_harga_terakhir]}</span></td>
                    <td className="pr-3 text-suka-brown/60">{b.ref_tanggal_terakhir ?? '—'}{b.ref_id_terakhir ? ` · ${b.ref_id_terakhir.slice(0, 8)}` : ''}</td>
                    <td className="text-right">{rp(b.nilai)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-suka-cream p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-suka-brown/60">{label}</p>
      <p className="mt-1 text-lg font-black text-suka-brown">{value}</p>
      {sub && <p className="text-[11px] text-suka-brown/60">{sub}</p>}
    </div>
  )
}
