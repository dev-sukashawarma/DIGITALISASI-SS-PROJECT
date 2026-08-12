'use client'

import React, { useState, useEffect } from 'react';
import { Check, X, Clock, Loader2, AlertTriangle, Search, XCircle, Building2, ChevronDown, ShieldAlert, KeyRound } from 'lucide-react';
import { processVoidOrder } from '../actions/cancellations';
import { searchCompletedOrders, forceCancelCompletedOrder, getMyOutletsForVoid } from '../actions/orderVoid';
import { processBypassRequest, getBypassRequests, type BypassRequestItem } from '../actions/bypass';
import { useApprovals } from '../../lib/ApprovalsContext';
import { PeriodFilter, PeriodValue } from '../../components/PeriodFilter';
import { presetRange } from '../../lib/period';
import { toast } from 'sonner';

type CompletedOrderRow = {
  id: string
  order_number: number
  customer_name: string | null
  total_amount: number
  created_at: string
}

type OutletOption = { id: string; name: string }

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

export default function ApprovalsClient({ 
  initialRequests,
  initialBypassRequests = []
}: { 
  initialRequests: any[];
  initialBypassRequests?: BypassRequestItem[];
}) {
  const { pendingRequests: requests, refreshApprovals } = useApprovals()
  const [bypassRequests, setBypassRequests] = useState<BypassRequestItem[]>(initialBypassRequests)
  const [loadingIds, setLoadingIds] = useState<string[]>([])
  const [tab, setTab] = useState<'pending' | 'bypass' | 'completed'>('pending')
  const [period, setPeriod] = useState<PeriodValue>(presetRange('today'))

  const [myOutlets, setMyOutlets] = useState<OutletOption[]>([])
  const [outletsLoaded, setOutletsLoaded] = useState(false)
  const [outletId, setOutletId] = useState('')
  const [outletPickerOpen, setOutletPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CompletedOrderRow[]>([])
  const [searching, setSearching] = useState(false)
  const [target, setTarget] = useState<CompletedOrderRow | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reload bypass requests periodically when on bypass tab
  const reloadBypassRequests = async () => {
    const res = await getBypassRequests()
    if (res.success && res.data) {
      setBypassRequests(res.data)
    }
  }

  useEffect(() => {
    if (tab === 'bypass') {
      reloadBypassRequests()
    }
  }, [tab])

  useEffect(() => {
    if (tab !== 'completed' || outletsLoaded) return
    getMyOutletsForVoid().then(res => {
      const list = (res.data || []) as OutletOption[]
      setMyOutlets(list)
      if (list.length === 1) setOutletId(list[0].id)
      setOutletsLoaded(true)
    })
  }, [tab, outletsLoaded])

  const fetchCompletedOrders = async () => {
    if (!outletId) return
    setSearching(true)
    try {
      const res = await searchCompletedOrders(outletId, query, period)
      if (res.success) {
        setResults(res.data as CompletedOrderRow[])
      } else {
        toast.error(res.error || 'Gagal mencari pesanan')
      }
    } finally {
      setSearching(false)
    }
  }

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    fetchCompletedOrders()
  }

  useEffect(() => {
    if (tab === 'completed' && outletId) {
      fetchCompletedOrders()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, outletId, tab])

  const filteredPendingRequests = React.useMemo(() => {
    return requests.filter(req => {
      if (!period.from || !period.to) return true
      const reqDate = new Date(req.created_at)
      const from = new Date(`${period.from}T00:00:00+07:00`)
      const to = new Date(`${period.to}T23:59:59.999+07:00`)
      return reqDate >= from && reqDate <= to
    })
  }, [requests, period])

  const filteredBypassRequests = React.useMemo(() => {
    return bypassRequests.filter(req => {
      if (!period.from || !period.to) return true
      const reqDate = new Date(req.created_at)
      const from = new Date(`${period.from}T00:00:00+07:00`)
      const to = new Date(`${period.to}T23:59:59.999+07:00`)
      return reqDate >= from && reqDate <= to
    })
  }, [bypassRequests, period])

  const closeVoidModal = () => {
    setTarget(null)
    setNote('')
  }

  const handleForceCancel = async () => {
    if (!target || !outletId || !note.trim()) return
    setSubmitting(true)
    try {
      const res = await forceCancelCompletedOrder(target.id, outletId, note)
      if (res.success) {
        toast.success(`Pesanan #${target.order_number} berhasil dibatalkan.`)
        setResults(prev => prev.filter(r => r.id !== target.id))
        closeVoidModal()
      } else {
        toast.error(res.error || 'Gagal membatalkan pesanan')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'void' | 'bypass';
    action: 'approve' | 'reject' | null;
    token: string;
    requestId: string;
  }>({ isOpen: false, type: 'void', action: null, token: '', requestId: '' })

  const requestAction = (token: string, action: 'approve' | 'reject', requestId: string, type: 'void' | 'bypass' = 'void') => {
    setConfirmDialog({ isOpen: true, type, action, token, requestId })
  }

  const handleAction = async () => {
    const { token, action, requestId, type } = confirmDialog;
    if (!action) return;

    setConfirmDialog({ isOpen: false, type: 'void', action: null, token: '', requestId: '' });
    setLoadingIds(prev => [...prev, requestId])

    try {
      if (type === 'bypass') {
        const res = await processBypassRequest(requestId, action)
        if (res.success) {
          toast.success(`Pengajuan bypass POS berhasil di-${action === 'approve' ? 'setujui' : 'tolak'}.`)
          setBypassRequests(prev => prev.filter(b => b.id !== requestId))
        } else {
          toast.error('Gagal memproses bypass: ' + res.error)
        }
      } else {
        const res = await processVoidOrder(token, action)
        if (res.success) {
          await refreshApprovals()
          toast.success(`Berhasil ${action === 'approve' ? 'menyetujui' : 'menolak'} pembatalan pesanan.`)
        } else {
          toast.error('Gagal memproses pembatalan: ' + res.error)
        }
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
        <h2 className="text-xl sm:text-2xl font-black text-suka-brown">Persetujuan &amp; Pembatalan</h2>
        <div className="w-full sm:w-auto">
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-white rounded-2xl border border-suka-brown/5 p-1.5 w-fit shadow-sm">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            tab === 'pending' ? 'bg-suka-orange text-white shadow-sm shadow-suka-orange/20' : 'text-suka-gray-500 hover:text-suka-brown hover:bg-suka-cream/40'
          }`}
        >
          Void Transaksi
          {requests.length > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${tab === 'pending' ? 'bg-white/25 text-white' : 'bg-suka-orange/10 text-suka-orange'}`}>
              {requests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab('bypass')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            tab === 'bypass' ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/20' : 'text-suka-gray-500 hover:text-suka-brown hover:bg-suka-cream/40'
          }`}
        >
          <ShieldAlert size={14} className={tab === 'bypass' ? 'text-white' : 'text-amber-500'} />
          Bypass POS / Absensi
          {bypassRequests.length > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${tab === 'bypass' ? 'bg-white/25 text-white' : 'bg-amber-500/10 text-amber-600'}`}>
              {bypassRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab('completed')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            tab === 'completed' ? 'bg-suka-brown text-white shadow-sm' : 'text-suka-gray-500 hover:text-suka-brown hover:bg-suka-cream/40'
          }`}
        >
          Pesanan Selesai
        </button>
      </div>

      {/* Tab 1: Void Transaksi */}
      {tab === 'pending' && (
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 overflow-hidden">
        <div className="p-4 border-b border-suka-brown/5 bg-suka-cream/30 flex justify-between items-center">
          <h3 className="font-bold text-suka-brown">Antrean Persetujuan Void Transaksi</h3>
          <span className="bg-suka-orange/10 text-suka-orange text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest shadow-sm">
            {filteredPendingRequests.length} Menunggu
          </span>
        </div>

        {filteredPendingRequests.length === 0 ? (
          <div className="p-8 text-center text-suka-gray-500 font-medium">
            Tidak ada pengajuan void transaksi saat ini.
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {filteredPendingRequests.map(req => (
              <div 
                key={req.id} 
                className="group relative bg-white border border-suka-gray-200/60 hover:border-suka-orange/30 rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:shadow-lg hover:shadow-suka-orange/5 overflow-hidden flex flex-col md:flex-row md:items-start justify-between gap-6"
              >
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

                  {req.order_items && req.order_items.length > 0 && (
                    <div className="border-t border-suka-gray-100 pt-3">
                      <div className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span>Rincian Pesanan</span>
                        <div className="h-px bg-suka-gray-200 flex-1"></div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {req.order_items.map((item: any, idx: number) => (
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
                      onClick={() => requestAction(req.token, 'reject', req.id, 'void')}
                      disabled={loadingIds.includes(req.id)}
                      className="flex-1 sm:flex-none flex items-center justify-center w-12 h-12 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-xl transition-all shadow-sm shrink-0 disabled:opacity-50 group/btn"
                      title="Tolak Pembatalan"
                    >
                      {loadingIds.includes(req.id) ? <Loader2 size={20} className="animate-spin" /> : <X size={22} strokeWidth={3} className="group-hover/btn:scale-110 transition-transform" />}
                    </button>
                    <button 
                      onClick={() => requestAction(req.token, 'approve', req.id, 'void')}
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
      )}

      {/* Tab 2: Bypass POS / Absensi */}
      {tab === 'bypass' && (
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 overflow-hidden">
        <div className="p-4 border-b border-suka-brown/5 bg-amber-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-suka-brown">Antrean Persetujuan Bypass POS-Kasir</h3>
          </div>
          <span className="bg-amber-500/10 text-amber-700 text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest shadow-sm">
            {filteredBypassRequests.length} Request Active
          </span>
        </div>

        {filteredBypassRequests.length === 0 ? (
          <div className="p-8 text-center text-suka-gray-500 font-medium">
            Tidak ada pengajuan bypass POS yang sedang menunggu persetujuan.
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {filteredBypassRequests.map(req => (
              <div 
                key={req.id} 
                className="group relative bg-white border border-amber-200/60 hover:border-amber-500/30 rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/5 overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 to-amber-300 group-hover:from-amber-600 group-hover:to-amber-400 transition-colors duration-300" />
                
                <div className="flex-1 min-w-0 pl-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-suka-brown/5 text-suka-brown text-xs font-black tracking-wide uppercase border border-suka-brown/10">
                      {req.outlet_name}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-suka-gray-400 uppercase tracking-widest">
                      <Clock size={12} className="text-suka-gray-300" /> 
                      {getTimeAgo(req.created_at)}
                    </span>
                  </div>

                  <h4 className="text-base sm:text-lg font-black text-suka-gray-800 tracking-tight mb-2 flex items-center gap-2">
                    Request Bypass POS dari <span className="text-amber-600">{req.requested_by_name}</span>
                  </h4>

                  <div className="bg-amber-500/5 rounded-xl p-3.5 border border-amber-500/10 relative">
                    <div className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black tracking-widest text-amber-700 uppercase">
                      Alasan Bypass
                    </div>
                    <p className="text-sm text-suka-gray-700 font-semibold leading-relaxed">
                      "{req.reason}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-suka-gray-100">
                  <button 
                    onClick={() => requestAction('', 'reject', req.id, 'bypass')}
                    disabled={loadingIds.includes(req.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-50 group/btn"
                  >
                    {loadingIds.includes(req.id) ? <Loader2 size={16} className="animate-spin" /> : <X size={16} strokeWidth={3} />}
                    Tolak
                  </button>
                  <button 
                    onClick={() => requestAction('', 'approve', req.id, 'bypass')}
                    disabled={loadingIds.includes(req.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white hover:bg-amber-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-amber-600/20 hover:shadow-md hover:shadow-amber-600/30 disabled:opacity-50 group/btn"
                  >
                    {loadingIds.includes(req.id) ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                    Setujui Bypass
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Tab 3: Pesanan Selesai */}
      {tab === 'completed' && (
        <div className="space-y-4">
          {!outletsLoaded ? (
            <div className="bg-white rounded-2xl p-8 text-center text-suka-gray-500 font-medium border border-suka-brown/5 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat outlet...
            </div>
          ) : myOutlets.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-suka-gray-500 font-medium border border-suka-brown/5">
              Anda belum ditugaskan ke outlet mana pun.
            </div>
          ) : (
            <>
              {myOutlets.length > 1 ? (
                <div className="relative w-fit">
                  <button
                    onClick={() => setOutletPickerOpen(o => !o)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold shadow-sm ${
                      outletId
                        ? 'bg-suka-orange text-white border-suka-orange shadow-[0_2px_8px_rgba(249,115,22,0.3)]'
                        : 'bg-white text-suka-brown border-suka-brown/20 hover:border-suka-brown/40'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="max-w-[160px] truncate">
                      {myOutlets.find(o => o.id === outletId)?.name ?? 'Pilih Outlet'}
                    </span>
                    <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${outletPickerOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {outletPickerOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOutletPickerOpen(false)} />
                      <div className="absolute left-0 top-full mt-2 bg-white border border-suka-brown/10 rounded-2xl shadow-xl py-2 z-50 w-56 overflow-hidden">
                        <p className="px-4 py-1.5 text-[10px] font-black text-suka-gray-400 uppercase tracking-wider border-b border-suka-brown/5 mb-1">
                          Pilih Outlet
                        </p>
                        {myOutlets.map(o => (
                          <button
                            key={o.id}
                            onClick={() => { setOutletId(o.id); setResults([]); setOutletPickerOpen(false) }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left ${
                              outletId === o.id
                                ? 'bg-suka-orange/10 text-suka-orange font-black'
                                : 'text-suka-gray-600 hover:bg-suka-gray-50 font-bold'
                            }`}
                          >
                            <span className="truncate">{o.name}</span>
                            {outletId === o.id && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs font-black text-suka-gray-400 uppercase tracking-widest">
                  Outlet: <span className="text-suka-brown">{myOutlets[0].name}</span>
                </p>
              )}

              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-suka-gray-400" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    disabled={!outletId}
                    placeholder="Cari nama pelanggan atau nomor pesanan..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-suka-brown/10 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-suka-orange/30 disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || !outletId}
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
        </div>
      )}

      {/* Confirmation Modal Void Force-Cancel */}
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
                  onClick={closeVoidModal}
                  className="flex-1 py-2.5 rounded-xl border-2 border-suka-gray-200 text-suka-gray-600 font-bold hover:bg-suka-gray-50"
                >
                  Kembali
                </button>
                <button
                  onClick={handleForceCancel}
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

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-suka-brown/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-6 ${confirmDialog.action === 'approve' ? 'bg-amber-50' : 'bg-red-50'} flex flex-col items-center text-center`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmDialog.action === 'approve' ? 'bg-amber-600 text-white' : 'bg-red-500 text-white'}`}>
                {confirmDialog.action === 'approve' ? <Check size={24} strokeWidth={3} /> : <AlertTriangle size={24} />}
              </div>
              <h3 className={`text-lg font-black mb-1 ${confirmDialog.action === 'approve' ? 'text-amber-700' : 'text-red-600'}`}>
                Konfirmasi {confirmDialog.action === 'approve' ? 'Persetujuan' : 'Penolakan'}
              </h3>
              <p className="text-sm text-suka-gray-600 font-medium">
                Apakah Anda yakin ingin {confirmDialog.action === 'approve' ? 'MENYETUJUI' : 'MENOLAK'} {confirmDialog.type === 'bypass' ? 'pengajuan bypass POS ini' : 'pembatalan transaksi ini'}?
              </p>
            </div>
            <div className="p-4 bg-white flex gap-3">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, type: 'void', action: null, token: '', requestId: '' })}
                className="flex-1 py-2.5 rounded-xl border-2 border-suka-gray-200 text-suka-gray-600 font-bold hover:bg-suka-gray-50 transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={handleAction}
                className={`flex-1 py-2.5 rounded-xl text-white font-bold transition-all shadow-sm ${
                  confirmDialog.action === 'approve' 
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' 
                    : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
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
