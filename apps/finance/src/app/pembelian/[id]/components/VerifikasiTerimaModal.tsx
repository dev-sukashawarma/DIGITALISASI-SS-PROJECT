// @ts-nocheck
'use client'

import { useState } from 'react'
import { X, CheckCircle, PackageCheck, AlertCircle } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import type { PurchaseOrder } from '@/hooks/usePurchaseOrder'
import { useVerifikasiTerimaPO } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'

type Props = {
  po: PurchaseOrder
  onClose: () => void
}

type ItemState = {
  id: string
  qty_terima: number
  harga_terima: number
  kondisi: 'baik' | 'rusak'
  catatan: string
}

export function VerifikasiTerimaModal({ po, onClose }: Props) {
  const verifikasi = useVerifikasiTerimaPO()
  
  // Inisialisasi state sesuai default dari PO
  const [items, setItems] = useState<ItemState[]>(
    po.items.map(it => ({
      id: it.id,
      qty_terima: it.qty_terima ?? it.qty_pesan,
      harga_terima: it.harga_terima ?? it.harga_pesan,
      kondisi: (it.kondisi as 'baik' | 'rusak') ?? 'baik',
      catatan: it.catatan || ''
    }))
  )

  const updateItem = (id: string, field: keyof ItemState, value: any) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    verifikasi.mutate({
      poId: po.id,
      items: items
    }, {
      onSuccess: () => onClose()
    })
  }

  const isSaving = verifikasi.isPending

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl border border-suka-brown/10 animate-fade-in">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-suka-brown/5 flex items-center justify-between bg-suka-cream/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-suka-brown to-suka-ink text-white flex items-center justify-center shadow-xs">
              <PackageCheck className="w-5 h-5 text-suka-orange" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-suka-brown">Penerimaan &amp; Verifikasi Barang</h2>
              <p className="text-xs font-semibold text-suka-brown/60">Verifikasi fisik barang yang tiba untuk PO <span className="font-mono text-suka-brown">{po.nomor_po}</span></p>
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
        <div className="p-6 max-h-[60vh] overflow-y-auto bg-suka-cream/20">
          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex gap-3 mb-5 shadow-2xs">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 font-medium leading-relaxed">
              Pastikan mengecek kondisi fisik barang dan nota pengiriman. Jika ada barang rusak atau kurang, ubah kolom Kondisi. 
              Data kuantitas yang berstatus "Baik" akan secara otomatis menambah saldo stok Gudang Kitchen.
            </div>
          </div>

          <form id="verifikasi-form" onSubmit={handleSubmit} className="space-y-4">
            {po.items.map((poItem) => {
              const state = items.find(i => i.id === poItem.id)!
              const isAdhoc = !poItem.bahan_baku_id
              
              return (
                <div key={poItem.id} className="bg-white/95 border border-suka-brown/10 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-suka-brown text-sm sm:text-base">
                        {isAdhoc ? poItem.item_description : poItem.bahan_baku?.nama}
                      </h3>
                      {isAdhoc && (
                        <span className="inline-block px-2 py-0.5 bg-suka-cream text-suka-brown text-[10px] font-bold rounded-lg border border-suka-brown/10 mt-1">
                          Ad-hoc (Non-Katalog)
                        </span>
                      )}
                      <p className="text-xs font-semibold text-suka-brown/60 mt-1">
                        Dipesan: <span className="text-suka-brown font-bold tabular-nums">{poItem.qty_pesan} {isAdhoc ? poItem.satuan_ad_hoc : poItem.bahan_baku?.satuan_standar}</span> &bull; 
                        Harga PO: <span className="text-suka-brown font-bold tabular-nums">{rupiah(poItem.harga_pesan)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-dashed border-suka-brown/10">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-suka-brown/70 uppercase tracking-wider">Qty Terima</label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={state.qty_terima}
                        onChange={e => updateItem(poItem.id, 'qty_terima', parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2 bg-suka-cream/30 border border-suka-brown/15 rounded-xl focus:border-suka-orange outline-none transition-all font-bold text-xs tabular-nums"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-suka-brown/70 uppercase tracking-wider">Harga Aktual</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-suka-brown/40 text-xs">Rp</span>
                        <input 
                          type="number"
                          min="0"
                          required
                          value={state.harga_terima}
                          onChange={e => updateItem(poItem.id, 'harga_terima', parseInt(e.target.value) || 0)}
                          className="w-full pl-9 pr-3.5 py-2 bg-suka-cream/30 border border-suka-brown/15 rounded-xl focus:border-suka-orange outline-none transition-all font-bold text-xs tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-suka-brown/70 uppercase tracking-wider">Kondisi</label>
                      <select 
                        value={state.kondisi}
                        onChange={e => updateItem(poItem.id, 'kondisi', e.target.value)}
                        className="w-full px-3.5 py-2 bg-suka-cream/30 border border-suka-brown/15 rounded-xl focus:border-suka-orange outline-none transition-all font-bold text-xs cursor-pointer"
                      >
                        <option value="baik">✅ Baik (Sesuai)</option>
                        <option value="rusak">❌ Rusak / Tolak</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-suka-brown/70 uppercase tracking-wider">Catatan</label>
                      <input 
                        type="text"
                        placeholder="Opsional (cth: kemasan bocor)"
                        value={state.catatan}
                        onChange={e => updateItem(poItem.id, 'catatan', e.target.value)}
                        className="w-full px-3.5 py-2 bg-suka-cream/30 border border-suka-brown/15 rounded-xl focus:border-suka-orange outline-none transition-all font-medium text-xs text-suka-ink"
                      />
                    </div>
                  </div>

                </div>
              )
            })}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-suka-brown/5 bg-suka-cream/30 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 text-xs font-bold text-suka-brown/70 hover:bg-white rounded-2xl border border-suka-brown/15 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button 
            type="submit"
            form="verifikasi-form"
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-suka-brown to-suka-ink text-white text-xs font-bold rounded-2xl hover:opacity-95 transition-all shadow-md shadow-suka-brown/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Spinner className="w-4 h-4 text-white" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
            <span>Simpan Penerimaan</span>
          </button>
        </div>

      </div>
    </div>
  )
}
