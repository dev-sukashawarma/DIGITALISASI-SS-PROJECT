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
  order_items: {
    menu_item_name: string;
    quantity: number;
    subtotal: number;
  }[];
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
          <div className="flex flex-col gap-4">
            {requests.map(req => (
              <div 
                key={req.id} 
                className="group relative bg-white border border-suka-gray-200/60 hover:border-suka-orange/30 rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:shadow-lg hover:shadow-suka-orange/5 overflow-hidden flex flex-col md:flex-row md:items-start justify-between gap-6"
              >
                {/* Left Accent Bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-suka-orange/40 to-suka-orange/10 group-hover:from-suka-orange group-hover:to-suka-orange/60 transition-colors duration-300" />
                
                <div className="flex-1 min-w-0 pl-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-suka-brown/5 text-suka-brown text-xs font-black tracking-wide uppercase border border-suka-brown/10">
                      {req.outlet_name}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-suka-gray-400 uppercase tracking-widest">
                      <Clock size={12} className="text-suka-gray-300" /> 
                      {getTimeAgo(req.created_at)}
                    </span>
                  </div>
                  
                  <h4 className="text-base sm:text-lg font-black text-suka-gray-800 tracking-tight mb-1 flex items-baseline gap-2">
                    Void Transaksi <span className="text-suka-orange">#{req.order_number}</span>
                  </h4>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-semibold text-suka-gray-500">Pelanggan:</span>
                    <span className="text-sm font-bold text-suka-gray-700">{req.customer_name}</span>
                    <span className="text-suka-gray-300 mx-1">•</span>
                    <span className="text-sm font-semibold text-suka-gray-500">Kasir:</span>
                    <span className="text-sm font-bold text-suka-gray-700">{req.requester_name}</span>
                  </div>

                  <div className="bg-suka-brown/5 rounded-xl p-3.5 border border-suka-brown/10 relative mb-4">
                    <div className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black tracking-widest text-suka-brown uppercase">
                      Alasan Pembatalan
                    </div>
                    <p className="text-sm text-suka-gray-700 font-semibold leading-relaxed">
                      "{req.reason}"
                    </p>
                  </div>

                  {/* Order Items Table - Industrial Style */}
                  {req.order_items && req.order_items.length > 0 && (
                    <div className="border-t border-suka-gray-100 pt-3">
                      <div className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span>Rincian Pesanan</span>
                        <div className="h-px bg-suka-gray-200 flex-1"></div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {req.order_items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-baseline text-sm">
                            <div className="flex gap-2 items-baseline">
                              <span className="font-bold text-suka-gray-500 w-5">{item.quantity}x</span>
                              <span className="font-semibold text-suka-gray-700">{item.menu_item_name}</span>
                            </div>
                            <span className="font-bold text-suka-gray-500 text-xs tabular-nums">
                              {formatRupiah(item.subtotal || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-center md:items-end lg:items-center justify-between md:justify-start gap-5 sm:gap-6 pt-4 md:pt-0 border-t md:border-t-0 border-suka-gray-100">
                  <div className="text-center md:text-right">
                    <span className="block text-[10px] font-bold text-suka-gray-400 uppercase tracking-widest mb-1">Total Nilai</span>
                    <span className="text-2xl font-black text-suka-brown tracking-tight">
                      {formatRupiah(req.total_amount || 0)}
                    </span>
                  </div>
                  
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => requestAction(req.token, 'reject', req.id)}
                      disabled={loadingIds.includes(req.id)}
                      className="flex-1 sm:flex-none flex items-center justify-center w-12 h-12 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-xl transition-all shadow-sm shrink-0 disabled:opacity-50 group/btn"
                      title="Tolak Pembatalan"
                    >
                      {loadingIds.includes(req.id) ? <Loader2 size={20} className="animate-spin" /> : <X size={22} strokeWidth={3} className="group-hover/btn:scale-110 transition-transform" />}
                    </button>
                    <button 
                      onClick={() => requestAction(req.token, 'approve', req.id)}
                      disabled={loadingIds.includes(req.id)}
                      className="flex-[2] sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-suka-orange text-white hover:bg-suka-orange/90 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-sm shadow-suka-orange/20 hover:shadow-md hover:shadow-suka-orange/30 disabled:opacity-50 group/btn"
                    >
                      {loadingIds.includes(req.id) ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} className="group-hover/btn:scale-110 transition-transform" />} 
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
