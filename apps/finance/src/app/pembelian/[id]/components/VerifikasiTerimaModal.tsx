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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-suka-gray-100 flex items-center justify-between bg-suka-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-suka-ink text-white flex items-center justify-center shadow-xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-suka-ink">Penerimaan Barang</h2>
              <p className="text-sm font-medium text-suka-gray-400">Verifikasi fisik barang yang tiba untuk PO {po.nomor_po}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-suka-gray-400 hover:text-suka-ink hover:bg-suka-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto bg-[#F8F9FA]">
          <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 font-medium leading-relaxed">
              Pastikan mengecek kondisi fisik barang. Jika ada barang rusak, ubah kolom Kondisi. 
              Data kuantitas yang berstatus "Baik" akan secara otomatis menambah stok Gudang Kitchen.
            </div>
          </div>

          <form id="verifikasi-form" onSubmit={handleSubmit} className="space-y-4">
            {po.items.map((poItem) => {
              const state = items.find(i => i.id === poItem.id)!
              const isAdhoc = !poItem.bahan_baku_id
              
              return (
                <div key={poItem.id} className="bg-white border border-suka-gray-200 rounded-2xl p-4 shadow-2xs flex flex-col gap-4">
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-suka-ink text-base">
                        {isAdhoc ? poItem.item_description : poItem.bahan_baku?.nama}
                      </h3>
                      {isAdhoc && (
                        <span className="inline-block px-2 py-0.5 bg-suka-gray-100 text-suka-gray-500 text-xs font-bold rounded-md mt-1">
                          Ad-hoc (Non-Katalog)
                        </span>
                      )}
                      <p className="text-sm font-medium text-suka-gray-400 mt-1">
                        Dipesan: <span className="text-suka-ink font-bold">{poItem.qty_pesan} {isAdhoc ? poItem.satuan_ad_hoc : poItem.bahan_baku?.satuan_standar}</span> &bull; 
                        Harga: <span className="text-suka-ink font-bold">{rupiah(poItem.harga_pesan)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-dashed border-suka-gray-100">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Qty Terima</label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={state.qty_terima}
                        onChange={e => updateItem(poItem.id, 'qty_terima', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-suka-gray-50 border border-suka-gray-200 rounded-xl focus:border-suka-ink focus:ring-1 focus:ring-suka-ink outline-none transition-all font-bold"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Harga Aktual</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-suka-gray-400">Rp</span>
                        <input 
                          type="number"
                          min="0"
                          required
                          value={state.harga_terima}
                          onChange={e => updateItem(poItem.id, 'harga_terima', parseInt(e.target.value) || 0)}
                          className="w-full pl-10 pr-4 py-2.5 bg-suka-gray-50 border border-suka-gray-200 rounded-xl focus:border-suka-ink focus:ring-1 focus:ring-suka-ink outline-none transition-all font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Kondisi</label>
                      <select 
                        value={state.kondisi}
                        onChange={e => updateItem(poItem.id, 'kondisi', e.target.value)}
                        className="w-full px-4 py-2.5 bg-suka-gray-50 border border-suka-gray-200 rounded-xl focus:border-suka-ink focus:ring-1 focus:ring-suka-ink outline-none transition-all font-bold"
                      >
                        <option value="baik">✅ Baik</option>
                        <option value="rusak">❌ Rusak / Tolak</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Catatan</label>
                      <input 
                        type="text"
                        placeholder="Opsional"
                        value={state.catatan}
                        onChange={e => updateItem(poItem.id, 'catatan', e.target.value)}
                        className="w-full px-4 py-2.5 bg-suka-gray-50 border border-suka-gray-200 rounded-xl focus:border-suka-ink focus:ring-1 focus:ring-suka-ink outline-none transition-all font-medium text-sm"
                      />
                    </div>
                  </div>

                </div>
              )
            })}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-suka-gray-100 bg-white flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 text-sm font-extrabold text-suka-gray-500 hover:bg-suka-gray-100 rounded-xl transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button 
            type="submit"
            form="verifikasi-form"
            disabled={isSaving}
            className="px-6 py-2.5 bg-suka-ink text-white text-sm font-extrabold rounded-xl hover:bg-black transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Spinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            Simpan Penerimaan
          </button>
        </div>

      </div>
    </div>
  )
}
