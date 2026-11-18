'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/* Lencana status Xendit untuk pesanan website di Histori Transaksi
 * (spec 2026-11-18-validasi-xendit). Bentuk data mengikuti lib/posReport/xenditStatus. */

type Bayar = {
  xenditId: string
  refQris: string | null
  nominal: number
  dibayarAt: string
  caraCocok: string | null
  namaPelanggan?: string | null
  ringkasanItem?: string | null
  outletId?: string | null
}
type Info = { status: 'terverifikasi' | 'belum' | 'selisih' | 'dobel'; bayar: Bayar[] }

const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const jamWib = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function TombolSalin({ teks }: { teks: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      title="Salin ID transaksi Xendit"
      onClick={() => { navigator.clipboard?.writeText(teks).then(() => { setOk(true); setTimeout(() => setOk(false), 1200) }) }}
      className="inline-flex items-center text-gray-400 hover:text-gray-700"
    >
      {ok ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

function DetailBayar({ b }: { b: Bayar }) {
  return (
    <div className="text-[10px] text-gray-500 mt-0.5 flex items-center justify-end gap-1 flex-wrap">
      <span title={b.xenditId}>ID {b.xenditId.slice(0, 8)}…</span>
      <TombolSalin teks={b.xenditId} />
      {b.refQris && <span>· Ref QRIS {b.refQris}</span>}
      {b.caraCocok === 'file_nominal_jam' && <span className="italic">· dicocokkan lewat nominal & jam</span>}
    </div>
  )
}

export default function XenditBadge({ info, total }: { info: Info; total: number }) {
  const gaya = {
    terverifikasi: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    belum: 'bg-gray-50 text-gray-500 border-gray-200',
    selisih: 'bg-amber-50 text-amber-800 border-amber-200',
    dobel: 'bg-amber-50 text-amber-800 border-amber-200',
  }[info.status]
  const label = {
    terverifikasi: '✓ Xendit',
    belum: '⏳ Belum di Xendit',
    selisih: `⚠ Selisih: Xendit ${rp(info.bayar[0]?.nominal ?? 0)} vs POS ${rp(total)}`,
    dobel: `⚠ Dobel: ${info.bayar.length}× bayar di Xendit`,
  }[info.status]
  return (
    <div className="mt-1.5">
      <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${gaya}`}>{label}</span>
      {info.bayar.map(b => <DetailBayar key={b.xenditId} b={b} />)}
    </div>
  )
}

/** Pembayaran Xendit yang tidak punya pesanan POS selesai (tidak ikut total mana pun). */
export function XenditLainBlok({ items, tersembunyi }: { items: { jenis: 'hanya_xendit' | 'batal'; bayar: Bayar }[]; tersembunyi: number }) {
  if (items.length === 0 && tersembunyi === 0) return null
  return (
    <div className="mx-5 mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
      {items.length > 0 && (
        <>
          <p className="font-bold text-amber-900 mb-2">
            ⚠ {items.length} pembayaran Xendit tanpa pesanan selesai di POS <span className="font-normal text-amber-800">(tidak dihitung di total)</span>
          </p>
          <ul className="space-y-1.5">
            {items.map(({ jenis, bayar }) => (
              <li key={bayar.xenditId} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-amber-900">
                  {jamWib(bayar.dibayarAt)} · <strong>{rp(bayar.nominal)}</strong>
                  {bayar.namaPelanggan ? ` · ${bayar.namaPelanggan}` : ''}
                  {bayar.ringkasanItem ? ` · ${bayar.ringkasanItem}` : ''}
                  {' — '}
                  {jenis === 'batal' ? 'pesanan POS dibatalkan' : 'tidak ada di POS'}
                </span>
                <DetailBayar b={bayar} />
              </li>
            ))}
          </ul>
        </>
      )}
      {tersembunyi > 0 && (
        <p className="text-xs text-amber-800 mt-2">
          {tersembunyi} pembayaran Xendit belum diketahui outletnya — lihat di <strong>Semua Cabang</strong>.
        </p>
      )}
    </div>
  )
}
