'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, AlertCircle } from 'lucide-react'
import { useCreatePO, useSuppliers, useBahanBakuOptions } from '@/hooks/usePurchaseOrder'
import { rupiah } from '@/lib/format'
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
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-suka-gray-50 text-gray-400 hover:text-suka-brown transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-suka-brown tracking-tight">Buat Purchase Order</h1>
          <p className="text-sm text-gray-500">PO akan dibuat dengan status Draft.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          {/* Info PO */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-suka-brown text-sm uppercase tracking-wide">Informasi Pembelian</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Tanggal PO</label>
                <input type="date" value={tanggalPo} onChange={e => setTanggalPo(e.target.value)}
                  className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Supplier</label>
                <select value={supplierId} onChange={e => handleSupplierChange(e.target.value)}
                  className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20 bg-white">
                  <option value="">— Pilih atau ketik baru —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
                </select>
              </div>
            </div>

            {/* Nama supplier manual jika tidak ada di master */}
            {!supplierId && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Nama Supplier (jika tidak ada di master)
                </label>
                <input type="text" value={supplierNama} onChange={e => setSupplierNama(e.target.value)}
                  placeholder="Contoh: Pak Budi Ayam Bogor"
                  className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Catatan (opsional)</label>
              <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2}
                placeholder="Catatan khusus untuk PO ini..."
                className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20 resize-none" />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-suka-brown text-sm uppercase tracking-wide">Daftar Bahan</h2>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const bahan = bahanList.find(b => b.id === item.bahan_baku_id)
                const subtotal = (parseFloat(item.qty_pesan) || 0) * (parseFloat(item.harga_pesan) || 0)
                return (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2 p-3 bg-suka-gray-50 rounded-xl">
                    <div className="flex-1">
                      <select
                        value={item.bahan_baku_id}
                        onChange={e => handleBahanChange(idx, e.target.value)}
                        className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-suka-brown/20"
                      >
                        <option value="">— Pilih bahan —</option>
                        {bahanList
                          .filter(b => !usedBahanIds.has(b.id) || b.id === item.bahan_baku_id)
                          .map(b => <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-24">
                        <input type="number" min="0.01" step="0.01"
                          value={item.qty_pesan} onChange={e => updateItem(idx, 'qty_pesan', e.target.value)}
                          placeholder={`Qty${bahan ? ` (${bahan.satuan})` : ''}`}
                          className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20 text-right" />
                      </div>
                      <div className="w-32">
                        <input type="number" min="0"
                          value={item.harga_pesan} onChange={e => updateItem(idx, 'harga_pesan', e.target.value)}
                          placeholder="Harga/unit"
                          className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20 text-right" />
                      </div>
                      <div className="w-28 flex items-center justify-end text-sm font-bold text-suka-brown">
                        {subtotal > 0 ? rupiah(subtotal) : '—'}
                      </div>
                      <button onClick={() => removeItem(idx)} disabled={items.length === 1}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={addItem}
              className="flex items-center gap-2 text-sm font-bold text-suka-orange hover:text-suka-orange/80 transition-colors">
              <Plus size={14} /> Tambah Bahan
            </button>

            <div className="flex justify-between items-center pt-3 border-t border-suka-gray-100">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">Total Estimasi</span>
              <span className="text-lg font-extrabold text-suka-brown">{rupiah(totalEstimasi)}</span>
            </div>
          </div>

          {createPO.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span className="text-sm">{(createPO.error as Error).message}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => router.back()}
              className="flex-1 py-3 border border-suka-gray-200 rounded-xl font-bold text-sm text-gray-500 hover:bg-suka-gray-50 transition-colors">
              Batal
            </button>
            <button onClick={handleSubmit} disabled={!isValid || createPO.isPending}
              className="flex-1 py-3 bg-suka-orange text-white rounded-xl font-bold text-sm hover:bg-suka-orange/90 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {createPO.isPending ? <><Spinner className="w-4 h-4" /> Menyimpan...</> : '✓ Simpan PO'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
