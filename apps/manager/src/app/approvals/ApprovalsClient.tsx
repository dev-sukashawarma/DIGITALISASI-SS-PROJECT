'use client'

import React, { useState } from 'react';
import { Check, X, Clock, Loader2 } from 'lucide-react';
import { processVoidOrder } from '../actions/cancellations';
import { useApprovals } from '../../lib/ApprovalsContext';

type VoidRequest = {
  id: string
  order_id: string
  reason: string
  status: string
  created_at: string
  token: string
  order_number: string
  customer_name: string
  total_amount: number
  outlet_name: string
  requester_name: string
}

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const getTimeAgo = (dateString: string) => {
  const diffMs = new Date().getTime() - new Date(dateString).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins} Menit lalu`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} Jam lalu`
  return `${Math.floor(diffHours / 24)} Hari lalu`
}

export default function ApprovalsClient({ initialRequests }: { initialRequests: any[] }) {
  const { pendingRequests: requests, refreshApprovals } = useApprovals()
  const [loadingIds, setLoadingIds] = useState<string[]>([])

  const handleAction = async (token: string, action: 'approve' | 'reject', requestId: string) => {
    if (!confirm(`Apakah Anda yakin ingin ${action === 'approve' ? 'MENYETUJUI' : 'MENOLAK'} pembatalan ini?`)) {
      return
    }

    setLoadingIds(prev => [...prev, requestId])
    
    try {
      const res = await processVoidOrder(token, action)
      if (res.success) {
        await refreshApprovals()
        alert(`Berhasil ${action === 'approve' ? 'menyetujui' : 'menolak'} pembatalan pesanan.`)
      } else {
        alert('Gagal memproses pembatalan: ' + res.error)
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== requestId))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-black text-suka-brown">Persetujuan (Approvals)</h2>
      </div>
      
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 overflow-hidden">
        <div className="p-4 border-b border-suka-brown/5 bg-suka-cream/30 flex justify-between items-center">
          <h3 className="font-bold text-suka-brown">Antrean Persetujuan Void</h3>
          <span className="bg-suka-orange/10 text-suka-orange text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest shadow-sm">
            {requests.length} Menunggu
          </span>
        </div>
        
        {requests.length === 0 ? (
          <div className="p-8 text-center text-suka-gray-500 font-medium">
            Tidak ada pengajuan persetujuan saat ini.
          </div>
        ) : (
          <div className="divide-y divide-suka-brown/5">
            {requests.map(req => (
              <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-suka-orange/5 transition-colors group">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-black text-suka-brown">{req.outlet_name}</span>
                    <span className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={12} /> {getTimeAgo(req.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-suka-gray-700 font-bold">Void Transaksi {req.order_number} ({req.customer_name})</p>
                  <p className="text-[11px] font-semibold text-suka-gray-400 mt-1 uppercase tracking-wider">
                    Alasan: {req.reason} • Requested by: {req.requester_name}
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-4 md:mt-0">
                  <span className="text-2xl sm:text-xl font-black text-suka-brown">{formatRupiah(req.total_amount || 0)}</span>
                  <div className="flex gap-3 sm:gap-2">
                    <button 
                      onClick={() => handleAction(req.token, 'reject', req.id)}
                      disabled={loadingIds.includes(req.id)}
                      className="flex items-center justify-center w-12 h-12 sm:w-10 sm:h-10 bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-full transition-all shadow-sm shrink-0 disabled:opacity-50"
                    >
                      {loadingIds.includes(req.id) ? <Loader2 size={20} className="animate-spin" /> : <X size={20} strokeWidth={3} />}
                    </button>
                    <button 
                      onClick={() => handleAction(req.token, 'approve', req.id)}
                      disabled={loadingIds.includes(req.id)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-5 py-3 sm:py-2.5 bg-suka-orange text-white hover:bg-suka-orange/90 rounded-full text-sm sm:text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-suka-orange/20 hover:shadow-md hover:shadow-suka-orange/30 min-h-[48px] disabled:opacity-50"
                    >
                      {loadingIds.includes(req.id) ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} />} 
                      Setujui
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
