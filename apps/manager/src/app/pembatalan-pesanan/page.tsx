'use client'

import React, { useState } from 'react'
import { Search, AlertTriangle, Loader2, XCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { searchCompletedOrders, forceCancelCompletedOrder } from '../actions/orderVoid'

type OrderRow = {
  id: string
  order_number: number
  customer_name: string | null
  total_amount: number
  created_at: string
}

const formatRupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

export default function PembatalanPesananPage() {
  const searchParams = useSearchParams()
  const outletId = searchParams.get('outlet_id')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OrderRow[]>([])
  const [searching, setSearching] = useState(false)
  const [target, setTarget] = useState<OrderRow | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!outletId || !query.trim()) return
    setSearching(true)
    try {
      const res = await searchCompletedOrders(outletId, query)
      if (res.success) {
        setResults(res.data as OrderRow[])
        if (res.data.length === 0) toast.info('Tidak ada pesanan selesai yang cocok.')
      } else {
        toast.error(res.error || 'Gagal mencari pesanan')
      }
    } finally {
      setSearching(false)
    }
  }

  const closeModal = () => {
    setTarget(null)
    setNote('')
  }

  const handleCancel = async () => {
    if (!target || !outletId || !note.trim()) return
    setSubmitting(true)
    try {
      const res = await forceCancelCompletedOrder(target.id, outletId, note)
      if (res.success) {
        toast.success(`Pesanan #${target.order_number} berhasil dibatalkan.`)
        setResults(prev => prev.filter(r => r.id !== target.id))
        closeModal()
      } else {
        toast.error(res.error || 'Gagal membatalkan pesanan')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-black text-suka-brown">Batalkan Pesanan</h2>

      {!outletId ? (
        <div className="bg-white rounded-2xl p-8 text-center text-suka-gray-500 font-medium border border-suka-brown/5">
          Pilih outlet terlebih dahulu lewat filter outlet di pojok kanan atas.
        </div>
      ) : (
        <>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-suka-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Cari nama pelanggan atau nomor pesanan..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-suka-brown/10 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-suka-orange/30"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-5 py-3 rounded-xl bg-suka-orange text-white font-black text-sm disabled:opacity-50"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cari'}
            </button>
          </form>

          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 overflow-hidden">
            {results.length === 0 ? (
              <div className="p-8 text-center text-suka-gray-500 font-medium">
                Belum ada hasil. Hanya pesanan berstatus <b>selesai</b> yang bisa dibatalkan di sini.
              </div>
            ) : (
              <div className="divide-y divide-suka-brown/5">
                {results.map(order => (
                  <div key={order.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-black text-suka-brown">
                        #{order.order_number} <span className="text-suka-gray-400 font-semibold">&middot;</span>{' '}
                        {order.customer_name || 'Tanpa nama'}
                      </p>
                      <p className="text-xs font-bold text-suka-gray-400 mt-0.5">
                        {new Date(order.created_at).toLocaleString('id-ID')} &middot; {formatRupiah(order.total_amount || 0)}
                      </p>
                    </div>
                    <button
                      onClick={() => setTarget(order)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 font-black text-xs uppercase tracking-wider shrink-0"
                    >
                      <XCircle size={16} /> Batalkan
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {target && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-suka-brown/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-6 bg-red-50 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-black text-red-600 mb-1">Batalkan Pesanan #{target.order_number}</h3>
              <p className="text-sm text-suka-gray-600 font-medium">
                Pesanan ini akan ditandai batal. Catatan alasan wajib diisi.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Contoh: order double input, duplikat dari #123"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-suka-brown/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-200"
              />
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border-2 border-suka-gray-200 text-suka-gray-600 font-bold hover:bg-suka-gray-50"
                >
                  Kembali
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!note.trim() || submitting}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold bg-red-500 hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Ya, Batalkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
