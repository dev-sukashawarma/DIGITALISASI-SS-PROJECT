'use client'

import { useState, useEffect } from 'react'
import { createRequestAction } from '@/app/actions/inventory'
import { createSupabaseBrowserClient } from '@suka/auth'

export default function RequestInventoryPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  const [outlets, setOutlets] = useState<{id: string, name: string}[]>([])
  const [items, setItems] = useState<{id: string, name: string}[]>([])
  const [units, setUnits] = useState<{id: string, name: string}[]>([])
  
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.from('outlets').select('id,name').order('name').then(({ data }) => setOutlets(data ?? []))
    supabase.from('bahan_baku').select('id,nama').order('nama').then(({ data }) => setItems(data?.map(i => ({id: i.id, name: i.nama})) ?? []))
    supabase.from('inventory_units').select('id,name').order('name').then(({ data }) => setUnits(data ?? []))
  }, [supabase])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    const formData = new FormData(e.currentTarget)
    
    const outletId = formData.get('outletId') as string
    const itemId = formData.get('itemId') as string
    const requestedUnitId = formData.get('requestedUnitId') as string
    const requestedQty = Number(formData.get('requestedQty'))

    const res = await createRequestAction({
      outletId,
      items: [{
        itemId,
        requestedUnitId,
        requestedQty
      }]
    })

    if (res.success) {
      setMessage('Berhasil membuat permintaan barang!')
      ;(e.target as HTMLFormElement).reset()
    } else {
      setMessage(`Gagal: ${res.error}`)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-suka-brown tracking-tight">Permintaan Barang (Outlet)</h1>
      
      {message && (
        <div className={`p-4 mb-6 rounded-xl font-medium text-sm ${message.includes('Gagal') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-suka-gray-200">
        <div>
          <label className="block text-sm font-bold text-suka-brown mb-1.5">Outlet Peminta</label>
          <select name="outletId" required className="w-full p-2.5 border border-suka-gray-200 rounded-xl bg-suka-cream/20 text-suka-ink focus:border-suka-orange focus:ring-1 focus:ring-suka-orange outline-none transition-all">
            <option value="">Pilih Outlet...</option>
            {outlets.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-suka-brown mb-1.5">Bahan Baku (Item)</label>
          <select name="itemId" required className="w-full p-2.5 border border-suka-gray-200 rounded-xl bg-suka-cream/20 text-suka-ink focus:border-suka-orange focus:ring-1 focus:ring-suka-orange outline-none transition-all">
            <option value="">Pilih Bahan Baku...</option>
            {items.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-bold text-suka-brown mb-1.5">Satuan Permintaan</label>
            <select name="requestedUnitId" required className="w-full p-2.5 border border-suka-gray-200 rounded-xl bg-suka-cream/20 text-suka-ink focus:border-suka-orange focus:ring-1 focus:ring-suka-orange outline-none transition-all">
              <option value="">Pilih Satuan...</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-suka-brown mb-1.5">Jumlah (Qty)</label>
            <input name="requestedQty" type="number" min="1" step="any" required placeholder="Contoh: 5" className="w-full p-2.5 border border-suka-gray-200 rounded-xl bg-suka-cream/20 text-suka-ink focus:border-suka-orange focus:ring-1 focus:ring-suka-orange outline-none transition-all" />
          </div>
        </div>

        <div className="pt-2">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-suka-orange text-white font-bold py-3 rounded-xl hover:bg-[#d96815] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-suka-orange/20"
          >
            {loading ? 'Mengirim...' : 'Kirim Permintaan'}
          </button>
        </div>
      </form>
    </div>
  )
}
