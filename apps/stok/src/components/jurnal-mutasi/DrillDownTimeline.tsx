'use client'

import React, { useEffect, useState } from 'react'
import {
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Trash2,
  ShoppingBag,
  History,
  ClipboardCheck,
  Calculator,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import {
  fetchItemTransactionLedger,
  type LedgerTimelineRow,
  type ReconciliationItem,
  type ReconciliationPeriodInfo,
} from '@/app/actions/jurnalMutasi'
import { formatTriUnitSaldoFromGram } from '@/lib/format/compositeUnit'
import { ProofDetailModal } from './ProofDetailModal'

interface DrillDownTimelineProps {
  outletId: string
  item: ReconciliationItem
  startDate: string
  endDate: string
  period?: ReconciliationPeriodInfo
}

export function DrillDownTimeline({
  outletId,
  item,
  startDate,
  endDate,
  period,
}: DrillDownTimelineProps) {
  const [rows, setRows] = useState<LedgerTimelineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [proofTarget, setProofTarget] = useState<{ type: 'surat_jalan' | 'waste' | 'order'; id: string } | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchItemTransactionLedger(outletId, item.bahan_baku_id, startDate, endDate)
      .then((data) => {
        if (active) {
          setRows(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Gagal memuat riwayat transaksi')
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [outletId, item.bahan_baku_id, startDate, endDate])

  const formatQty = (qtySmall: number) => {
    return formatTriUnitSaldoFromGram(
      qtySmall,
      item.satuan,
      item.satuan_tengah,
      item.faktor_tengah,
      item.satuan_kecil,
      item.faktor_tampilan
    )
  }

  const formatRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

  // Format tanggal opname sebelum dan opname hari itu
  const opnameSebelumLabel = period?.opname_sebelumnya?.tanggal
    ? period.opname_sebelumnya.tanggal
    : period?.opname_sebelumnya?.created_at
    ? new Date(period.opname_sebelumnya.created_at).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date(startDate).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })

  const opnameHariIniLabel = period?.opname_terpilih?.tanggal
    ? period.opname_terpilih.tanggal
    : period?.opname_terpilih?.created_at
    ? new Date(period.opname_terpilih.created_at).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date(endDate).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })

  // Filter baris operasional: opname_selisih dikeluarkan karena ditampilkan di kesimpulan opname
  const operationalRows = rows.filter((r) => r.tipe !== 'opname_selisih')

  // Hitung running balance urut dari saldo awal
  let runningQty = item.saldo_awal_qty
  let runningRp = item.saldo_awal_rp

  const rowsWithBalance = operationalRows.map((r) => {
    runningQty += r.qty
    runningRp += r.debet_rp - r.kredit_rp
    return {
      ...r,
      running_qty: runningQty,
      running_rp: runningRp,
    }
  })

  // Total debet & kredit mutasi
  const totalDebetQty = operationalRows.reduce((acc, r) => (r.qty > 0 ? acc + r.qty : acc), 0)
  const totalKreditQty = operationalRows.reduce((acc, r) => (r.qty < 0 ? acc + Math.abs(r.qty) : acc), 0)
  const totalDebetRp = operationalRows.reduce((acc, r) => acc + r.debet_rp, 0)
  const totalKreditRp = operationalRows.reduce((acc, r) => acc + r.kredit_rp, 0)
  const netMutasiQty = totalDebetQty - totalKreditQty

  // Status dan keberadaan data opname fisik
  const hasOpname = item.has_opname ?? (item.stok_fisik_qty !== null && item.stok_fisik_qty !== undefined)
  const isMatch = hasOpname && Math.abs(item.selisih_qty ?? 0) <= 0.01
  const isNegativeDiff = hasOpname && (item.selisih_qty ?? 0) < -0.01
  const itemStatus: 'MATCH' | 'MINUS' | 'SURPLUS' | 'TIDAK_OPNAME' =
    item.status || (!hasOpname ? 'TIDAK_OPNAME' : isMatch ? 'MATCH' : isNegativeDiff ? 'MINUS' : 'SURPLUS')

  return (
    <div className="bg-suka-cream/15 p-4 sm:p-5 border-t border-b border-suka-brown/10 text-xs">
      {/* Header Info Bahan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-suka-brown/10">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-suka-orange" />
          <h4 className="font-black text-suka-brown uppercase tracking-wider text-[11px]">
            Buku Jurnal Kronologis: <span className="text-suka-orange">{item.nama}</span>
          </h4>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold text-suka-brown/60">
          <span>Master: {formatRp(item.harga_beli_master)} / {item.satuan}</span>
          <span>•</span>
          <span>Per Satuan Kecil: {formatRp(item.unit_price_kecil)} / {item.satuan_kecil || item.satuan}</span>
        </div>
      </div>

      {loading && (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-suka-orange" />
          <p className="text-suka-brown/50 font-bold uppercase tracking-wider text-[10px]">
            Menarik riwayat mutasi...
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-suka-brown/10 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-suka-brown/5 text-suka-brown/70 font-black text-[10px] uppercase tracking-wider border-b border-suka-brown/10">
                <tr>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Jenis Transaksi</th>
                  <th className="p-3">Keterangan / Ref</th>
                  <th className="p-3 text-right">Debet (Masuk)</th>
                  <th className="p-3 text-right">Kredit (Keluar)</th>
                  <th className="p-3 text-right">Debet (Rp)</th>
                  <th className="p-3 text-right">Kredit (Rp)</th>
                  <th className="p-3 text-right bg-suka-cream/30">Saldo Berjalan</th>
                  <th className="p-3 text-right bg-suka-cream/30">Nilai Saldo (Rp)</th>
                  <th className="p-3 text-center">Bukti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/10 font-medium text-[11px]">
                {/* 1. BARIS PALING ATAS: HASIL STOK OPNAME SEBELUM (SALDO AWAL) */}
                <tr className="bg-amber-50/70 border-b-2 border-amber-200 hover:bg-amber-50 transition-colors">
                  <td className="p-3 whitespace-nowrap text-amber-900 font-bold">
                    {opnameSebelumLabel}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                      <ClipboardCheck className="w-3 h-3 text-amber-700" />
                      Opname Sebelum
                    </span>
                  </td>
                  <td className="p-3 text-suka-brown">
                    <span className="font-black text-suka-brown">
                      Hasil Stok Opname Fisik Sebelumnya (Saldo Awal Periode)
                    </span>
                    {period?.opname_sebelumnya?.created_by_name && (
                      <span className="text-[10px] text-suka-brown/60 block">
                        Kru: {period.opname_sebelumnya.created_by_name}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right text-suka-brown/30">-</td>
                  <td className="p-3 text-right text-suka-brown/30">-</td>
                  <td className="p-3 text-right text-suka-brown/30">-</td>
                  <td className="p-3 text-right text-suka-brown/30">-</td>
                  <td className="p-3 text-right whitespace-nowrap font-black text-suka-brown bg-amber-100/40">
                    {formatQty(item.saldo_awal_qty)}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap font-black text-suka-brown bg-amber-100/40">
                    {formatRp(item.saldo_awal_rp)}
                  </td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                      Saldo Awal
                    </span>
                  </td>
                </tr>

                {/* 2. BARIS-BARIS MUTASI KRONOLOGIS */}
                {rowsWithBalance.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-5 text-center text-suka-brown/50 font-bold italic">
                      Tidak ada pergerakan transaksi tercatat (penjualan, kiriman, waste) pada periode ini.
                    </td>
                  </tr>
                )}

                {rowsWithBalance.map((row) => {
                  const isMasuk = row.qty > 0
                  return (
                    <tr key={row.id} className="hover:bg-suka-cream/20 transition-colors">
                      <td className="p-3 whitespace-nowrap text-suka-brown/70">
                        {new Date(row.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            row.tipe === 'terima_kiriman' || row.tipe === 'pembelian_supplier'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.tipe === 'pemakaian'
                              ? 'bg-blue-100 text-blue-800'
                              : row.tipe === 'waste'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isMasuk ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {row.tipe.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 max-w-[200px] truncate text-suka-brown" title={row.catatan || ''}>
                        {row.ref_doc_number && (
                          <span className="font-black text-suka-brown mr-1.5 underline decoration-suka-orange/40">
                            {row.ref_doc_number}:
                          </span>
                        )}
                        <span>{row.menu_terjual || row.catatan || '-'}</span>
                        {row.vendor_estimasi && (
                          <div className="text-[10px] font-bold text-emerald-700 truncate" title="Estimasi FIFO berdasarkan surat jalan">
                            ≈ Vendor: {row.vendor_estimasi} · Master {formatRp(item.harga_master_kirim)}/{item.satuan_kirim}
                          </div>
                        )}
                        {row.vendor_nama && (
                          <div className="text-[10px] font-bold text-emerald-700 truncate">Vendor: {row.vendor_nama} · Master {formatRp(item.harga_master_kirim)}/{item.satuan_kirim}</div>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap text-emerald-700 font-bold">
                        {isMasuk ? `+${formatQty(row.qty)}` : '-'}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap text-red-600 font-bold">
                        {!isMasuk ? `-${formatQty(Math.abs(row.qty))}` : '-'}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap text-emerald-700 font-black">
                        {row.debet_rp > 0 ? `+${formatRp(row.debet_rp)}` : '-'}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap text-red-600 font-black">
                        {row.kredit_rp > 0 ? `-${formatRp(row.kredit_rp)}` : '-'}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap font-black text-suka-brown bg-suka-cream/20">
                        {formatQty(row.running_qty)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap font-black text-suka-brown bg-suka-cream/20">
                        {formatRp(row.running_rp)}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {row.ref_shipment_id ? (
                          <button
                            onClick={() => setProofTarget({ type: 'surat_jalan', id: row.ref_shipment_id! })}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 mx-auto cursor-pointer shadow-2xs"
                          >
                            <FileText className="w-3 h-3" /> Bukti SJ
                          </button>
                        ) : row.ref_order_id ? (
                          <button
                            onClick={() => setProofTarget({ type: 'order', id: row.ref_order_id! })}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 mx-auto cursor-pointer shadow-2xs"
                          >
                            <ShoppingBag className="w-3 h-3" /> Menu POS
                          </button>
                        ) : row.tipe === 'waste' ? (
                          <button
                            onClick={() => setProofTarget({ type: 'waste', id: row.id })}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 mx-auto cursor-pointer shadow-2xs"
                          >
                            <Trash2 className="w-3 h-3" /> Foto Waste
                          </button>
                        ) : (
                          <span className="text-suka-brown/30">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {/* 3. BARIS PENUTUP A: TOTAL STOK SISTEM (BUKU KRONOLOGIS) */}
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                  <td className="p-3 whitespace-nowrap text-slate-500">
                    Cut-off Akhir
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 border border-slate-300">
                      <Calculator className="w-3 h-3 text-slate-600" />
                      Stok Sistem
                    </span>
                  </td>
                  <td className="p-3 text-slate-700">
                    <span className="font-black text-slate-900">Total Stok Akhir Sistem (Buku)</span>
                    <span className="text-[10px] text-slate-500 block">
                      Saldo Awal + Masuk ({formatQty(totalDebetQty)}) - Keluar ({formatQty(totalKreditQty)})
                    </span>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap text-emerald-700 font-bold">
                    {totalDebetQty > 0 ? `+${formatQty(totalDebetQty)}` : '-'}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap text-red-600 font-bold">
                    {totalKreditQty > 0 ? `-${formatQty(totalKreditQty)}` : '-'}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap text-emerald-700 font-bold">
                    {totalDebetRp > 0 ? `+${formatRp(totalDebetRp)}` : '-'}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap text-red-600 font-bold">
                    {totalKreditRp > 0 ? `-${formatRp(totalKreditRp)}` : '-'}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap font-black text-slate-900 bg-slate-100">
                    {formatQty(item.stok_sistem_qty)}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap font-black text-slate-900 bg-slate-100">
                    {formatRp(item.stok_sistem_rp)}
                  </td>
                  <td className="p-3 text-center text-slate-400 font-bold text-[10px]">
                    Sistem
                  </td>
                </tr>

                {/* 4. BARIS PENUTUP B: HASIL STOK OPNAME FISIK (HARI ITU) */}
                <tr className="bg-blue-50/70 font-bold border-t border-blue-200">
                  <td className="p-3 whitespace-nowrap text-blue-900">
                    {opnameHariIniLabel}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300">
                      <ClipboardCheck className="w-3 h-3 text-blue-700" />
                      Opname Fisik
                    </span>
                  </td>
                  <td className="p-3 text-blue-950">
                    <span className="font-black text-blue-950">
                      Hasil Hitung Fisik di Outlet (Hari Ini)
                    </span>
                    {period?.opname_terpilih?.created_by_name && (
                      <span className="text-[10px] text-blue-700 block">
                        Dihitung oleh kru: {period.opname_terpilih.created_by_name}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right text-slate-300">-</td>
                  <td className="p-3 text-right text-slate-300">-</td>
                  <td className="p-3 text-right text-slate-300">-</td>
                  <td className="p-3 text-right text-slate-300">-</td>
                  <td className="p-3 text-right whitespace-nowrap font-black text-blue-900 bg-blue-100/50">
                    {hasOpname && item.stok_fisik_qty !== null
                      ? formatQty(item.stok_fisik_qty)
                      : 'Belum Input Opname'}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap font-black text-blue-900 bg-blue-100/50">
                    {hasOpname && item.stok_fisik_rp !== null
                      ? formatRp(item.stok_fisik_rp)
                      : '-'}
                  </td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                      Fisik Riil
                    </span>
                  </td>
                </tr>

                {/* 5. BARIS PENUTUP C: SELISIH REKONSILIASI (FISIK - SISTEM) */}
                <tr
                  className={`border-t-2 ${
                    itemStatus === 'MATCH'
                      ? 'bg-emerald-50/90 text-emerald-950 border-emerald-400'
                      : itemStatus === 'MINUS'
                      ? 'bg-red-50/90 text-red-950 border-red-400'
                      : itemStatus === 'SURPLUS'
                      ? 'bg-amber-50/90 text-amber-950 border-amber-400'
                      : 'bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  <td className="p-3 whitespace-nowrap font-black">
                    AUDIT REKON
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        itemStatus === 'MATCH'
                          ? 'bg-emerald-200 text-emerald-900 border border-emerald-400'
                          : itemStatus === 'MINUS'
                          ? 'bg-red-200 text-red-900 border border-red-400'
                          : itemStatus === 'SURPLUS'
                          ? 'bg-amber-200 text-amber-900 border border-amber-400'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {itemStatus === 'MATCH' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                      {itemStatus === 'MINUS' && <AlertCircle className="w-3.5 h-3.5 text-red-700" />}
                      {itemStatus === 'SURPLUS' && <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />}
                      {itemStatus === 'TIDAK_OPNAME' && <HelpCircle className="w-3.5 h-3.5 text-slate-600" />}
                      {itemStatus === 'MATCH'
                        ? '🎯 KLOP / MATCH'
                        : itemStatus === 'MINUS'
                        ? '⚠️ SELISIH MINUS'
                        : itemStatus === 'SURPLUS'
                        ? '📈 SELISIH SURPLUS'
                        : 'BELUM OPNAME'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-black">
                      Selisih Opname (Fisik - Sistem)
                      {hasOpname && item.selisih_persen !== null && (
                        <span className="ml-1.5 font-bold text-[10px]">
                          ({item.selisih_persen > 0 ? '+' : ''}{item.selisih_persen}%)
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] opacity-80 block font-normal">
                      {itemStatus === 'MATCH'
                        ? 'Stok fisik sesuai 100% dengan catatan mutasi sistem.'
                        : itemStatus === 'MINUS'
                        ? 'Stok fisik lebih sedikit dari catatan sistem (indikasi barang hilang, porsi boros, atau belum lapor waste).'
                        : itemStatus === 'SURPLUS'
                        ? 'Stok fisik lebih banyak dari catatan sistem (indikasi surat jalan belum masuk atau porsi hemat).'
                        : 'Belum dilakukan penghitungan fisik opname untuk periode ini.'}
                    </span>
                  </td>
                  <td className="p-3 text-right text-slate-300">-</td>
                  <td className="p-3 text-right text-slate-300">-</td>
                  <td className="p-3 text-right text-slate-300">-</td>
                  <td className="p-3 text-right text-slate-300">-</td>
                  <td
                    className={`p-3 text-right whitespace-nowrap font-black text-xs ${
                      itemStatus === 'MATCH'
                        ? 'text-emerald-800 bg-emerald-100/60'
                        : itemStatus === 'MINUS'
                        ? 'text-red-700 bg-red-100/60'
                        : itemStatus === 'SURPLUS'
                        ? 'text-amber-800 bg-amber-100/60'
                        : 'text-slate-500 bg-slate-100'
                    }`}
                  >
                    {hasOpname && item.selisih_qty !== null
                      ? `${item.selisih_qty > 0 ? '+' : ''}${formatQty(item.selisih_qty)}`
                      : '-'}
                  </td>
                  <td
                    className={`p-3 text-right whitespace-nowrap font-black text-xs ${
                      itemStatus === 'MATCH'
                        ? 'text-emerald-800 bg-emerald-100/60'
                        : itemStatus === 'MINUS'
                        ? 'text-red-700 bg-red-100/60'
                        : itemStatus === 'SURPLUS'
                        ? 'text-amber-800 bg-amber-100/60'
                        : 'text-slate-500 bg-slate-100'
                    }`}
                  >
                    {hasOpname && item.selisih_rp !== null
                      ? `${item.selisih_rp > 0 ? '+' : ''}${formatRp(item.selisih_rp)}`
                      : '-'}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black ${
                        itemStatus === 'MATCH'
                          ? 'bg-emerald-200 text-emerald-900'
                          : itemStatus === 'MINUS'
                          ? 'bg-red-200 text-red-900'
                          : itemStatus === 'SURPLUS'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {itemStatus}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. REKAPITULASI CEPAT ALUR REKONSILIASI OPNAME */}
          <div className="mt-3.5 p-3.5 bg-white rounded-2xl border border-suka-brown/15 shadow-2xs">
            <div className="text-[10px] font-black text-suka-brown/70 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-suka-orange" />
                Alur Rekonsiliasi & Validasi Selisih Opname
              </span>
              <span className="text-suka-brown/50 font-normal lowercase">
                (satuan acuan: {item.satuan_kecil || item.satuan})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
                <span className="text-[9px] font-black text-amber-800 uppercase block mb-1">
                  1. Opname Sebelum
                </span>
                <span className="text-xs font-black text-amber-950 block">
                  {formatQty(item.saldo_awal_qty)}
                </span>
                <span className="text-[10px] font-bold text-amber-700/80 block">
                  {formatRp(item.saldo_awal_rp)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[9px] font-black text-slate-600 uppercase block mb-1">
                  2. Mutasi Bersih
                </span>
                <span
                  className={`text-xs font-black block ${
                    netMutasiQty >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {netMutasiQty >= 0 ? '+' : ''}
                  {formatQty(netMutasiQty)}
                </span>
                <span className="text-[10px] font-medium text-slate-500 block">
                  Masuk - Pakai - Waste
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-300">
                <span className="text-[9px] font-black text-slate-700 uppercase block mb-1">
                  3. Stok Sistem (Buku)
                </span>
                <span className="text-xs font-black text-slate-900 block">
                  {formatQty(item.stok_sistem_qty)}
                </span>
                <span className="text-[10px] font-bold text-slate-600 block">
                  {formatRp(item.stok_sistem_rp)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200">
                <span className="text-[9px] font-black text-blue-800 uppercase block mb-1">
                  4. Stok Fisik (Hari Ini)
                </span>
                <span className="text-xs font-black text-blue-950 block">
                  {hasOpname && item.stok_fisik_qty !== null
                    ? formatQty(item.stok_fisik_qty)
                    : 'Belum Opname'}
                </span>
                <span className="text-[10px] font-bold text-blue-700/80 block">
                  {hasOpname && item.stok_fisik_rp !== null
                    ? formatRp(item.stok_fisik_rp)
                    : '-'}
                </span>
              </div>
            </div>

            {/* Banner Hasil Selisih Akhir */}
            <div
              className={`mt-2.5 p-2.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2 ${
                itemStatus === 'MATCH'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : itemStatus === 'MINUS'
                  ? 'bg-red-50 border-red-300 text-red-950'
                  : itemStatus === 'SURPLUS'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                {itemStatus === 'MATCH' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                {itemStatus === 'MINUS' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                {itemStatus === 'SURPLUS' && <ArrowUpRight className="w-4 h-4 text-amber-600 shrink-0" />}
                {itemStatus === 'TIDAK_OPNAME' && <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />}
                <span className="text-[11px] font-black">
                  Kesimpulan Audit Selisih:{' '}
                  {hasOpname && item.selisih_qty !== null
                    ? `${item.selisih_qty > 0 ? '+' : ''}${formatQty(item.selisih_qty)} (${
                        item.selisih_rp !== null && item.selisih_rp > 0 ? '+' : ''
                      }${formatRp(item.selisih_rp || 0)})`
                    : 'Belum Diopname'}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-current/20">
                {itemStatus === 'MATCH'
                  ? '🎯 Sempurna (Klop)'
                  : itemStatus === 'MINUS'
                  ? '⚠️ Kurang / Defisit'
                  : itemStatus === 'SURPLUS'
                  ? '📈 Lebih / Surplus'
                  : '⏳ Menunggu Opname'}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Proof Modal */}
      {proofTarget && (
        <ProofDetailModal
          type={proofTarget.type}
          id={proofTarget.id}
          onClose={() => setProofTarget(null)}
        />
      )}
    </div>
  )
}
