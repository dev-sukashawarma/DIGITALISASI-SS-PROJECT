// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, AlertCircle, ShoppingCart, Check } from 'lucide-react'
import { useCreatePO, useSuppliers, useBahanBakuOptions } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
import { PageHeader } from '@/components/ui'
import { Spinner } from '@suka/design-system'

type ItemRow = {
  bahan_baku_id: string
  qty_pesan: string
  harga_pesan: string
}

export default function NewPOPage() {
  const router = useRouter()
  const { data: suppliers = [], isLoading: loadingSuppliers } = useSuppliers()
  const { data: bahanList = [], isLoading: loadingBahan } = useBahanBakuOptions()
  const createPO = useCreatePO()

  const [supplierId, setSupplierId] = useState('')
  const [supplierNama, setSupplierNama] = useState('')
  const [tanggalPo, setTanggalPo] = useState(() => new Date().toISOString().split('T')[0])
  const [catatan, setCatatan] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ bahan_baku_id: '', qty_pesan: '', harga_pesan: '' }])

  const isLoading = loadingSuppliers || loadingBahan

  function handleSupplierChange(id: string) {
    setSupplierId(id)
    const s = suppliers.find(s => s.id === id)
    setSupplierNama(s?.nama ?? '')
    
    if (s && s.bahan_baku_ids && s.bahan_baku_ids.length > 0) {
      const newItems = s.bahan_baku_ids.map(bId => {
        const bahan = bahanList.find(b => b.id === bId)
        return {
          bahan_baku_id: bId,
          qty_pesan: '',
          harga_pesan: bahan?.harga_beli ? String(bahan.harga_beli) : ''
        }
      })
      setItems(newItems)
    } else {
      setItems([{ bahan_baku_id: '', qty_pesan: '', harga_pesan: '' }])
    }
  }

  function handleBahanChange(idx: number, bahanId: string) {
    const bahan = bahanList.find(b => b.id === bahanId)
    setItems(prev => prev.map((it, i) =>
      i === idx ? {
        ...it,
        bahan_baku_id: bahanId,
        harga_pesan: bahan?.harga_beli ? String(bahan.harga_beli) : it.harga_pesan,
      } : it
    ))
  }

  function addItem() {
    setItems(prev => [...prev, { bahan_baku_id: '', qty_pesan: '', harga_pesan: '' }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ItemRow, value: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const totalEstimasi = items.reduce((s, it) =>
    s + (parseFloat(it.qty_pesan) || 0) * (parseFloat(it.harga_pesan) || 0), 0)

  const isValid = (supplierNama.trim() || supplierId) &&
    items.every(it => it.bahan_baku_id && parseFloat(it.qty_pesan) > 0) &&
    items.length > 0

  const usedBahanIds = new Set(items.map(i => i.bahan_baku_id).filter(Boolean))

  async function handleSubmit() {
    if (!isValid) return
    const nama = supplierNama.trim() || suppliers.find(s => s.id === supplierId)?.nama || ''
    await createPO.mutateAsync({
      supplier_id: supplierId || null,
      supplier_nama: nama,
      tanggal_po: tanggalPo,
      catatan: catatan.trim() || null,
      items: items
        .filter(it => it.bahan_baku_id && parseFloat(it.qty_pesan) > 0)
        .map(it => ({
          bahan_baku_id: it.bahan_baku_id,
          qty_pesan: parseFloat(it.qty_pesan),
          harga_pesan: parseFloat(it.harga_pesan) || 0,
        })),
    })
    router.push('/dashboard/pembelian')
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.back()} 
          className="p-2.5 rounded-2xl bg-white border border-suka-gray-200 hover:bg-suka-gray-50 text-suka-gray-500 hover:text-suka-brown transition-all shadow-2xs"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <PageHeader 
          title="Buat Purchase Order Baru" 
          description="PO baru akan dibuat secara otomatis dengan status Draft."
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-suka-orange" /></div>
      ) : (
        <>
          {/* Info PO */}
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-5">
            <h2 className="font-black text-suka-brown text-sm uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-suka-orange" />
              Informasi Pembelian
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Tanggal PO *</label>
                <input type="date" value={tanggalPo} onChange={e => setTanggalPo(e.target.value)}
                  className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Supplier *</label>
                <select value={supplierId} onChange={e => handleSupplierChange(e.target.value)}
                  className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all cursor-pointer">
                  <option value="">— Pilih atau ketik baru —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
                </select>
              </div>
            </div>

            {!supplierId && (
              <div>
                <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">
                  Nama Supplier Manual (jika tidak ada di master)
                </label>
                <input type="text" value={supplierNama} onChange={e => setSupplierNama(e.target.value)}
                  placeholder="Contoh: Pak Budi Ayam Bogor"
                  className="w-full pl-4 pr-3 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all" />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-suka-gray-500 mb-1.5 uppercase tracking-widest">Catatan Tambahan (opsional)</label>
              <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2}
                placeholder="Syarat pembayaran, instruksi pengiriman, dll."
                className="w-full pl-4 pr-3 py-2.5 text-xs font-medium text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all resize-none" />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-suka-brown text-sm uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-suka-orange" />
                Daftar Item Bahan Baku ({items.length})
              </h2>
              <button onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-extrabold text-suka-orange hover:text-orange-600 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200/60 transition-all active:scale-95">
                <Plus className="w-4 h-4" /> Tambah Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const bahan = bahanList.find(b => b.id === item.bahan_baku_id)
                const subtotal = (parseFloat(item.qty_pesan) || 0) * (parseFloat(item.harga_pesan) || 0)
                return (
                  <div key={idx} className="flex flex-col sm:flex-row gap-3 p-3.5 bg-white/80 rounded-2xl border border-suka-gray-200/60 shadow-2xs hover:border-suka-brown/20 transition-all">
                    <div className="flex-1">
                      <select
                        value={item.bahan_baku_id}
                        onChange={e => handleBahanChange(idx, e.target.value)}
                        className="w-full pl-3 pr-2 py-2 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange cursor-pointer"
                      >
                        <option value="">— Pilih bahan baku —</option>
                        {bahanList
                          .filter(b => !usedBahanIds.has(b.id) || b.id === item.bahan_baku_id)
                          .map(b => <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <div className="w-28">
                        <input type="number" min="0.01" step="0.01"
                          value={item.qty_pesan} onChange={e => updateItem(idx, 'qty_pesan', e.target.value)}
                          placeholder={`Qty${bahan ? ` (${bahan.satuan})` : ''}`}
                          className="w-full px-3 py-2 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange text-right" />
                      </div>
                      <div className="w-36">
                        <input type="number" min="0"
                          value={item.harga_pesan} onChange={e => updateItem(idx, 'harga_pesan', e.target.value)}
                          placeholder="Harga/unit (Rp)"
                          className="w-full px-3 py-2 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange text-right" />
                      </div>
                      <div className="w-28 text-right text-xs font-black text-suka-brown">
                        {subtotal > 0 ? rupiah(subtotal) : '—'}
                      </div>
                      <button onClick={() => removeItem(idx)} disabled={items.length === 1}
                        className="p-2 text-suka-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between items-center p-4 bg-suka-cream/40 rounded-2xl border border-suka-brown/10">
              <span className="text-xs font-black text-suka-gray-500 uppercase tracking-widest">Total Estimasi Nilai PO</span>
              <span className="text-xl font-black text-suka-brown">{rupiah(totalEstimasi)}</span>
            </div>
          </div>

          {createPO.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="text-xs font-bold">{(createPO.error as Error).message}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => router.back()}
              className="flex-1 py-3 border border-suka-gray-200 rounded-2xl font-bold text-sm text-suka-gray-500 hover:bg-suka-gray-50 transition-colors">
              Batal
            </button>
            <button onClick={handleSubmit} disabled={!isValid || createPO.isPending}
              className="flex-[2] py-3 bg-gradient-to-r from-suka-brown to-suka-ink text-white rounded-2xl font-extrabold text-sm hover:from-suka-ink hover:to-black active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(44,24,16,0.15)]">
              {createPO.isPending ? <><Spinner className="w-5 h-5" /> Menyimpan Draft...</> : <><Check className="w-5 h-5" /> Simpan Draft PO</>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

