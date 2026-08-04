'use client'

import React, { useState } from 'react';
import { Check, X, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { processVoidOrder } from '../actions/cancellations';
import { useApprovals } from '../../lib/ApprovalsContext';
import { toast } from 'sonner';

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

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | null;
    token: string;
    requestId: string;
  }>({ isOpen: false, action: null, token: '', requestId: '' })

  const requestAction = (token: string, action: 'approve' | 'reject', requestId: string) => {
    setConfirmDialog({ isOpen: true, action, token, requestId })
  }

  const handleAction = async () => {
    const { token, action, requestId } = confirmDialog;
    if (!action) return;

    setConfirmDialog({ isOpen: false, action: null, token: '', requestId: '' });
    setLoadingIds(prev => [...prev, requestId])
    
    try {
      const res = await processVoidOrder(token, action)
      if (res.success) {
        await refreshApprovals()
        toast.success(`Berhasil ${action === 'approve' ? 'menyetujui' : 'menolak'} pembatalan pesanan.`)
      } else {
        toast.error('Gagal memproses pembatalan: ' + res.error)
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan: ' + err.message)
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
                      onClick={() => requestAction(req.token, 'reject', req.id)}
                      disabled={loadingIds.includes(req.id)}
                      className="flex items-center justify-center w-12 h-12 sm:w-10 sm:h-10 bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-full transition-all shadow-sm shrink-0 disabled:opacity-50"
                    >
                      {loadingIds.includes(req.id) ? <Loader2 size={20} className="animate-spin" /> : <X size={20} strokeWidth={3} />}
                    </button>
                    <button 
                      onClick={() => requestAction(req.token, 'approve', req.id)}
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

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-suka-brown/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-6 ${confirmDialog.action === 'approve' ? 'bg-suka-orange/10' : 'bg-red-50'} flex flex-col items-center text-center`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmDialog.action === 'approve' ? 'bg-suka-orange text-white' : 'bg-red-500 text-white'}`}>
                {confirmDialog.action === 'approve' ? <Check size={24} strokeWidth={3} /> : <AlertTriangle size={24} />}
              </div>
              <h3 className={`text-lg font-black mb-1 ${confirmDialog.action === 'approve' ? 'text-suka-orange' : 'text-red-600'}`}>
                Konfirmasi {confirmDialog.action === 'approve' ? 'Persetujuan' : 'Penolakan'}
              </h3>
              <p className="text-sm text-suka-gray-600 font-medium">
                Apakah Anda yakin ingin {confirmDialog.action === 'approve' ? 'MENYETUJUI' : 'MENOLAK'} pembatalan ini?
              </p>
            </div>
            <div className="p-4 bg-white flex gap-3">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, action: null, token: '', requestId: '' })}
                className="flex-1 py-2.5 rounded-xl border-2 border-suka-gray-200 text-suka-gray-600 font-bold hover:bg-suka-gray-50 transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={handleAction}
                className={`flex-1 py-2.5 rounded-xl text-white font-bold transition-all shadow-sm ${
                  confirmDialog.action === 'approve' 
                    ? 'bg-suka-orange hover:bg-suka-orange/90 shadow-suka-orange/20 hover:shadow-suka-orange/30' 
                    : 'bg-red-500 hover:bg-red-600 shadow-red-500/20 hover:shadow-red-500/30'
                }`}
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
