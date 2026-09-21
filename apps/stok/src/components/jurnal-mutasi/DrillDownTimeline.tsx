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
} from 'lucide-react'
import { fetchItemTransactionLedger, type LedgerTimelineRow, type ReconciliationItem } from '@/app/actions/jurnalMutasi'
import { formatTriUnitSaldoFromGram } from '@/lib/format/compositeUnit'
import { ProofDetailModal } from './ProofDetailModal'

interface DrillDownTimelineProps {
  outletId: string
  item: ReconciliationItem
  startDate: string
  endDate: string
}

export function DrillDownTimeline({ outletId, item, startDate, endDate }: DrillDownTimelineProps) {
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

  return (
    <div className="bg-suka-cream/15 p-4 sm:p-5 border-t border-b border-suka-brown/10 text-xs">
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

      {!loading && !error && rows.length === 0 && (
        <div className="py-6 text-center text-suka-brown/50 font-bold italic">
          Tidak ada pergerakan transaksi tercatat untuk bahan ini pada periode terpilih.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
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
              {rows.map((row) => {
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
                            : row.tipe === 'opname_selisih'
                            ? 'bg-purple-100 text-purple-800'
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
                      <span>{row.catatan || '-'}</span>
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
                      {formatQty(row.saldo_sesudah_qty)}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap font-black text-suka-brown bg-suka-cream/20">
                      {formatRp(row.saldo_sesudah_rp)}
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
            </tbody>
          </table>
        </div>
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
