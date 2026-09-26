'use client'

import { useState } from 'react'
import { X, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import type { POWithItems } from '@/hooks/usePurchaseOrder'
import { useFinalisasiPO } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'

type Props = {
  po: POWithItems
  onClose: () => void
}

export function FinalisasiPOModal({ po, onClose }: Props) {
  const [alasan, setAlasan] = useState('')
  const finalisasi = useFinalisasiPO()

  // Hitung total sisa barang yang belum tiba
  const itemsWithSisa = po.items.map(it => {
    const qtyPesan = Number(it.qty_pesan || 0)
    const qtyTerima = Number(it.qty_terima || 0)
    const sisa = Math.max(0, qtyPesan - qtyTerima)
    const nama = (it as any).bahan_baku?.nama || it.item_description || 'Item PO'
    const satuan = (it as any).bahan_baku?.satuan || (it as any).satuan_ad_hoc || 'satuan'
    return {
      ...it,
      nama,
      satuan,
      qtyPesan,
      qtyTerima,
      sisa,
    }
  })

  const totalSisaItem = itemsWithSisa.filter(it => it.sisa > 0).length
  const totalNilaiSisa = itemsWithSisa.reduce((acc, it) => acc + (it.sisa * Number(it.harga_pesan || 0)), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!alasan.trim()) return

    finalisasi.mutate(
      { poId: po.id, alasan: alasan.trim() },
      {
        onSuccess: () => onClose(),
      }
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-suka-brown/10 animate-fade-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-suka-brown/5 flex items-center justify-between bg-suka-cream/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-800 border border-amber-500/20 flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-suka-brown">Finalisasi / Tutup PO Sisa</h2>
              <p className="text-xs font-semibold text-suka-brown/60">
                Selesaikan PO <span className="font-mono text-suka-brown font-bold">{po.nomor_po}</span> tanpa menambah stok sisa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-suka-brown/40 hover:text-suka-brown hover:bg-suka-cream rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 bg-suka-cream/20">
          {/* Warning Banner */}
          <div className="bg-amber-50/90 border border-amber-300/80 rounded-2xl p-4 flex gap-3 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 space-y-1.5 leading-relaxed">
              <p className="font-bold text-amber-900">Perhatian Sebelum Memfinalisasi:</p>
              <ul className="list-disc pl-4 space-y-1 text-amber-900/90 font-medium">
                <li>
                  Status PO akan berubah menjadi <strong>Diterima Lengkap</strong> (tuntas/closed).
                </li>
                <li>
                  <strong>Sisa barang yang belum tiba ({totalSisaItem} item) TIDAK AKAN ditambahkan ke stok gudang</strong> (saldo stok fisik tetap sesuai aktual yang pernah datang).
                </li>
                <li>
                  Tagihan invoice dan laporan realisasi hanya memperhitungkan barang yang riil diterima.
                </li>
              </ul>
            </div>
          </div>

          {/* Rincian Item & Sisa */}
          <div className="bg-white/90 rounded-2xl border border-suka-brown/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-suka-brown uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-suka-orange" />
                Ringkasan Realisasi Kiriman Item
              </h3>
              {totalNilaiSisa > 0 && (
                <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                  Estimasi Nilai Sisa: {rupiah(totalNilaiSisa)}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-suka-brown/10 text-suka-brown/60 font-semibold select-none">
                    <th className="pb-2">Nama Bahan / Item</th>
                    <th className="pb-2 text-right">Pesan</th>
                    <th className="pb-2 text-right">Diterima</th>
                    <th className="pb-2 text-right">Sisa Batal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-brown/5">
                  {itemsWithSisa.map(it => (
                    <tr key={it.id} className="hover:bg-amber-50/30">
                      <td className="py-2.5 font-medium text-suka-brown">
                        {it.nama}
                        <span className="text-[10px] text-suka-brown/50 ml-1 font-normal">({it.satuan})</span>
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-suka-brown/70">{it.qtyPesan}</td>
                      <td className="py-2.5 text-right font-bold tabular-nums text-emerald-800">{it.qtyTerima}</td>
                      <td className="py-2.5 text-right font-bold tabular-nums">
                        {it.sisa > 0 ? (
                          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {it.sisa} {it.satuan}
                          </span>
                        ) : (
                          <span className="text-emerald-700">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Input Alasan */}
          <form id="finalisasi-form" onSubmit={handleSubmit} className="space-y-2">
            <label className="block text-xs font-bold text-suka-brown">
              Alasan Penutupan / Pembatalan Sisa PO <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={alasan}
              onChange={e => setAlasan(e.target.value)}
              placeholder="Contoh: Stok di supplier sudah habis dan disepakati PO ditutup tanpa kiriman sisa..."
              rows={3}
              required
              className="w-full text-xs p-3.5 bg-white border border-suka-brown/20 rounded-2xl text-suka-brown placeholder:text-suka-brown/40 focus:outline-none focus:border-suka-orange transition-colors shadow-2xs font-medium"
            />
            <p className="text-[11px] text-suka-brown/50 italic">
              Alasan ini akan dicatat permanen pada catatan riwayat PO untuk keperluan audit pengadaan.
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-suka-brown/5 bg-suka-cream/30 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={finalisasi.isPending}
            className="px-5 py-2.5 text-xs font-bold text-suka-brown/70 hover:bg-white rounded-2xl border border-suka-brown/15 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            form="finalisasi-form"
            disabled={finalisasi.isPending || !alasan.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-700 to-suka-brown text-white text-xs font-bold rounded-2xl hover:opacity-95 transition-all shadow-md shadow-suka-brown/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {finalisasi.isPending ? <Spinner className="w-4 h-4 text-white" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>Finalisasi &amp; Tutup PO</span>
          </button>
        </div>
      </div>
    </div>
  )
}
