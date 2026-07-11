'use client'

import { useState, useEffect } from 'react'
import { dispatchRequestAction } from '@/app/actions/inventory'
import { createSupabaseBrowserClient } from '@suka/auth'

export default function DispatchRequestPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [requests, setRequests] = useState<{id: string, outlet_id: string, status: string}[]>([])
  const [outlets, setOutlets] = useState<{id: string, name: string}[]>([])
  
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.from('outlets').select('id,name').then(({ data }) => setOutlets(data ?? []))
    // Fetch pending requests
    supabase.from('internal_requests')
      .select('id, outlet_id, status')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRequests(data ?? []))
  }, [supabase])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    const formData = new FormData(e.currentTarget)
    
    const requestId = formData.get('requestId') as string
    const kitchenLocationId = formData.get('kitchenLocationId') as string

    const res = await dispatchRequestAction({
      requestId,
      kitchenLocationId
    })

    if (res.success) {
      setMessage('Berhasil memproses dan mengirim barang (FIFO diterapkan)!')
      ;(e.target as HTMLFormElement).reset()
      // Refresh requests
      supabase.from('internal_requests').select('id, outlet_id, status').eq('status', 'PENDING').then(({ data }) => setRequests(data ?? []))
    } else {
      setMessage(`Gagal: ${(res as any).error}`)
    }
    setLoading(false)
  }

  // Helper untuk mendapatkan nama outlet
  const getOutletName = (id: string) => outlets.find(o => o.id === id)?.name || id

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-suka-brown tracking-tight">Pengiriman Barang ke Outlet (Dispatch)</h1>
      
      {message && (
        <div className={`p-4 mb-6 rounded-xl font-medium text-sm ${message.includes('Gagal') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-suka-gray-200">
        <div>
          <label className="block text-sm font-bold text-suka-brown mb-1.5">ID Request (Permintaan Outlet)</label>
          <select name="requestId" required className="w-full p-2.5 border border-suka-gray-200 rounded-xl bg-suka-cream/20 text-suka-ink focus:border-suka-orange focus:ring-1 focus:ring-suka-orange outline-none transition-all">
            <option value="">Pilih Permintaan Pending...</option>
            {requests.map(req => (
              <option key={req.id} value={req.id}>
                {getOutletName(req.outlet_id)} - {req.id.split('-')[0]}...
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-bold text-suka-brown mb-1.5">Lokasi Pengirim (Kitchen/Gudang)</label>
          <select name="kitchenLocationId" required className="w-full p-2.5 border border-suka-gray-200 rounded-xl bg-suka-cream/20 text-suka-ink focus:border-suka-orange focus:ring-1 focus:ring-suka-orange outline-none transition-all">
            <option value="">Pilih Gudang Pengirim...</option>
            {outlets.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <p className="text-xs text-suka-gray-500 mt-1.5">Stok FIFO akan dipotong dari lokasi gudang ini.</p>
        </div>

        <div className="pt-2">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-suka-orange text-white font-bold py-3 rounded-xl hover:bg-[#d96815] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-suka-orange/20"
          >
            {loading ? 'Memproses FIFO...' : 'Proses & Kirim'}
          </button>
        </div>
      </form>
    </div>
  )
}
