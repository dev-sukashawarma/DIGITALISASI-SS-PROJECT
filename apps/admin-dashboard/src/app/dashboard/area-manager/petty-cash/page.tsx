'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Clock, Store, ShieldCheck, Send, History, Filter, XCircle, ArrowRight, Loader2, RefreshCw, Camera, X, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatRupiah } from '@/lib/validations'
import { formatRelativeTime, formatDateTime } from '@/lib/date'
import { toast } from 'sonner'
import { getAreaManagerPettyCashTopups } from './actions'

interface TopupRequest {
  id: string
  outlet_id: string
  amount: number
  description: string
  status: string
  created_at: string
  bank_name?: string | null
  bank_account_number?: string | null
  bank_account_name?: string | null
  proof_of_transfer_url?: string | null
  outlet?: { name: string; region?: string | null } | null
}

function ProofImageLightbox({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void }) {
  if (!imageUrl) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Foto Bukti Transfer Finance</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-50">
          <img src={imageUrl} alt="Bukti Transfer" className="max-h-[65vh] w-auto object-contain rounded-xl shadow-sm border border-slate-200" />
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 font-medium">Lampiran Bukti Transfer Resmi</span>
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            download="Bukti_Transfer_Petty_Cash.jpg"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Unduh Foto Utuh
          </a>
        </div>
      </div>
    </div>
  )
}

function formatRole(role?: string) {
  if (!role) return 'Staff'
  const map: Record<string, string> = {
    leader: 'Leader',
    area_manager: 'Area Manager',
    admin_finance: 'Finance',
    crew: 'Crew',
    admin: 'Admin',
    owner: 'Owner',
    spv: 'Supervisor'
  }
  return map[role] || role.replace('_', ' ').toUpperCase()
}

export default function AreaManagerPettyCashPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<TopupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ name: string; role: string } | null>(null)

  // Tabs: 'review' | 'history'
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')

  // Sub-filters
  const [reviewFilter, setReviewFilter] = useState<'all' | 'unapproved' | 'ready_handover'>('all')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'acc_finance' | 'forwarded_leader' | 'completed' | 'rejected'>('all')

  const loadRequests = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const [res, { data: authUser }] = await Promise.all([
        getAreaManagerPettyCashTopups(),
        supabase.auth.getUser()
      ])

      if (authUser?.user && !userProfile) {
        const { data: staff } = await supabase
          .from('outlet_staff')
          .select('name, role')
          .eq('id', authUser.user.id)
          .maybeSingle()
        if (staff) setUserProfile(staff)
      }

      if (!res.success) throw new Error(res.error)

      if (res.data) {
        const bogorRequests = res.data.map((r: any) => ({
          ...r,
          outlet: r.outlets ? { name: r.outlets.name, region: r.outlets.region } : null
        }))

        setRequests(bogorRequests)
      }
    } catch (err: any) {
      console.error(err)
      if (!isSilent) toast.error('Gagal memuat data petty cash: ' + err.message)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [supabase, userProfile])

  useEffect(() => {
    loadRequests()

    const channel = supabase
      .channel('am-petty-cash-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'petty_cash_topups' },
        () => {
          loadRequests(true)
        }
      )
      .subscribe()

    const interval = setInterval(() => {
      loadRequests(true)
    }, 15000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [loadRequests, supabase])

  async function handleApprove(id: string) {
    if (!confirm('Setujui pengajuan ini dan teruskan ke Finance?')) return
    setIsProcessing(id)

    const prevRequests = [...requests]
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'forwarded_to_finance' } : r))

    try {
      const { error } = await supabase.rpc('area_manager_process_petty_cash', {
        p_topup_id: id,
        p_action: 'approve'
      })
      if (error) throw error

      toast.success('Pengajuan disetujui & diteruskan ke Finance!')
    } catch (err: any) {
      setRequests(prevRequests)
      toast.error('Gagal menyetujui pengajuan: ' + err.message)
    } finally {
      setIsProcessing(null)
      loadRequests(true)
    }
  }

  async function handleReject(id: string) {
    if (!confirm('Tolak pengajuan ini? Status akan menjadi Ditolak.')) return
    setIsProcessing(id)

    const prevRequests = [...requests]
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r))

    try {
      const { error } = await supabase.rpc('area_manager_process_petty_cash', {
        p_topup_id: id,
        p_action: 'reject'
      })
      if (error) throw error

      toast.error('Pengajuan telah ditolak.')
    } catch (err: any) {
      setRequests(prevRequests)
      toast.error('Gagal menolak pengajuan: ' + err.message)
    } finally {
      setIsProcessing(null)
      loadRequests(true)
    }
  }

  async function handleForwardToLeader(id: string) {
    if (!confirm('Teruskan penyerahan dana ke Leader Cabang?')) return
    setIsProcessing(id)

    const prevRequests = [...requests]
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'forwarded_by_area_manager' } : r))

    try {
      const { error } = await supabase.rpc('area_manager_forward_funds', {
        p_topup_id: id
      })
      if (error) throw error

      toast.success('Dana berhasil diserahkan ke Leader!')
    } catch (err: any) {
      setRequests(prevRequests)
      toast.error('Gagal penyerahan dana: ' + err.message)
    } finally {
      setIsProcessing(null)
      loadRequests(true)
    }
  }

  const allReviewRequests = requests.filter(r => 
    r.status === 'pending' ||
    r.status === 'forwarded_to_area_manager' || 
    r.status === 'approved_by_finance' || 
    r.status === 'forwarded_by_finance'
  )
  
  const allHistoryRequests = requests.filter(r => 
    r.status !== 'pending' &&
    r.status !== 'forwarded_to_area_manager' && 
    r.status !== 'approved_by_finance' && 
    r.status !== 'forwarded_by_finance'
  )

  const filteredReviewRequests = allReviewRequests.filter(r => {
    if (reviewFilter === 'unapproved') {
      return r.status === 'pending' || r.status === 'forwarded_to_area_manager'
    }
    if (reviewFilter === 'ready_handover') {
      return r.status === 'approved_by_finance' || r.status === 'forwarded_by_finance'
    }
    return true
  })

  const filteredHistoryRequests = allHistoryRequests.filter(r => {
    if (historyFilter === 'acc_finance') return r.status === 'forwarded_to_finance'
    if (historyFilter === 'forwarded_leader') return r.status === 'forwarded_by_area_manager'
    if (historyFilter === 'completed') return r.status === 'forwarded_by_leader' || r.status === 'completed'
    if (historyFilter === 'rejected') return r.status === 'rejected'
    return true
  })

  const unapprovedCount = allReviewRequests.filter(r => r.status === 'pending' || r.status === 'forwarded_to_area_manager').length
  const readyHandoverCount = allReviewRequests.filter(r => r.status === 'approved_by_finance' || r.status === 'forwarded_by_finance').length

  const accFinanceCount = allHistoryRequests.filter(r => r.status === 'forwarded_to_finance').length
  const forwardedLeaderCount = allHistoryRequests.filter(r => r.status === 'forwarded_by_area_manager').length
  const completedCount = allHistoryRequests.filter(r => r.status === 'forwarded_by_leader' || r.status === 'completed').length
  const rejectedCount = allHistoryRequests.filter(r => r.status === 'rejected').length

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 font-sans">
      
      {/* HEADER BAR - Solid Clean UI */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Dashboard Area Manager - Approval Petty Cash
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              {userProfile && (
                <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md mr-2">
                  USER: {userProfile.name} ({formatRole(userProfile.role)})
                </span>
              )}
              Review pengajuan dana dari cabang Wilayah Bogor & kelola serah terima ke Leader.
            </p>
          </div>
        </div>

        <button
          onClick={() => loadRequests(false)}
          disabled={loading || isRefreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          {isRefreshing ? 'Memperbarui...' : 'Refresh Realtime'}
        </button>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'review'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          Butuh Review & Serah Terima ({allReviewRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <History className="w-4 h-4" />
          Riwayat Pengajuan Area Manager ({allHistoryRequests.length})
        </button>
      </div>

      {/* TAB 1: REVIEW / ACTION NEEDED */}
      {activeTab === 'review' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            <button
              onClick={() => setReviewFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                reviewFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Semua ({allReviewRequests.length})
            </button>
            <button
              onClick={() => setReviewFilter('unapproved')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                reviewFilter === 'unapproved'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Belum di-ACC ({unapprovedCount})
            </button>
            <button
              onClick={() => setReviewFilter('ready_handover')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                reviewFilter === 'ready_handover'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Siap Diserahkan ({readyHandoverCount})
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl animate-pulse flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-slate-200 rounded w-1/4" />
                      <div className="h-5 bg-slate-200 rounded w-1/2" />
                    </div>
                    <div className="h-10 bg-slate-200 rounded w-28 shrink-0" />
                  </div>
                ))}
              </div>
            ) : filteredReviewRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium">
                Tidak ada pengajuan pada kategori ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredReviewRequests.map((req) => (
                  <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-slate-500" /> {req.outlet?.name || 'Unknown Outlet'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200" title={formatDateTime(req.created_at)}>
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatRelativeTime(req.created_at)}
                        </span>
                        {(req.status === 'pending' || req.status === 'forwarded_to_area_manager') && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> BELUM DI-ACC (MENUNGGU AM)
                          </span>
                        )}
                        {(req.status === 'approved_by_finance' || req.status === 'forwarded_by_finance') && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> DICAIRKAN FINANCE (SERAHKAN KE LEADER)
                          </span>
                        )}
                      </div>

                      <p className="font-bold text-slate-900 text-base">{req.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 inline-block font-medium">
                          <span className="font-bold text-slate-900">Rekening Tujuan: </span>
                          {req.bank_name ? (
                            <span>{req.bank_name} - <b className="font-mono text-slate-900">{req.bank_account_number}</b> (a.n {req.bank_account_name || '-'})</span>
                          ) : (
                            <span className="italic text-slate-400">Belum ada</span>
                          )}
                        </div>

                        {req.proof_of_transfer_url && (
                          <button
                            type="button"
                            onClick={() => setSelectedProofUrl(req.proof_of_transfer_url || null)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-xl border border-emerald-200 transition-colors shadow-xs cursor-pointer"
                          >
                            <Camera className="w-4 h-4 text-emerald-600" />
                            <span>Lihat Bukti Transfer Finance</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Nominal</p>
                        <p className="text-xl font-black text-blue-600">{formatRupiah(req.amount)}</p>
                      </div>

                      <div className="flex gap-2">
                        {(req.status === 'pending' || req.status === 'forwarded_to_area_manager') && (
                          <>
                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={isProcessing === req.id}
                              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer border border-red-200"
                            >
                              Tolak
                            </button>
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={isProcessing === req.id}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-bold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                              {isProcessing === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              Acc & Ke Finance
                            </button>
                          </>
                        )}

                        {(req.status === 'approved_by_finance' || req.status === 'forwarded_by_finance') && (
                          <button
                            onClick={() => handleForwardToLeader(req.id)}
                            disabled={isProcessing === req.id}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                          >
                            {isProcessing === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Serahkan ke Leader
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: RIWAYAT PENGAJUAN AREA MANAGER */}
      {activeTab === 'history' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filter Riwayat:
            </span>
            <button
              onClick={() => setHistoryFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                historyFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Semua ({allHistoryRequests.length})
            </button>
            <button
              onClick={() => setHistoryFilter('acc_finance')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                historyFilter === 'acc_finance'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Sudah di-ACC (Ke Finance) ({accFinanceCount})
            </button>
            <button
              onClick={() => setHistoryFilter('forwarded_leader')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                historyFilter === 'forwarded_leader'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Diserahkan ke Leader ({forwardedLeaderCount})
            </button>
            <button
              onClick={() => setHistoryFilter('completed')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                historyFilter === 'completed'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Selesai (Crew Terima) ({completedCount})
            </button>
            <button
              onClick={() => setHistoryFilter('rejected')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                historyFilter === 'rejected'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Ditolak ({rejectedCount})
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-3.5 font-bold">Waktu / Tanggal</th>
                    <th className="px-6 py-3.5 font-bold">Outlet</th>
                    <th className="px-6 py-3.5 font-bold">Nominal</th>
                    <th className="px-6 py-3.5 font-bold">Alasan / Keperluan</th>
                    <th className="px-6 py-3.5 font-bold">Status Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-medium">
                        Memuat data riwayat...
                      </td>
                    </tr>
                  ) : filteredHistoryRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-medium">
                        Tidak ada riwayat pengajuan pada kategori ini.
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-600" title={formatDateTime(r.created_at)}>
                          <div className="font-bold text-slate-900">{formatRelativeTime(r.created_at)}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{formatDateTime(r.created_at)}</div>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <Store className="w-4 h-4 text-slate-400" />
                            {r.outlet?.name || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-black text-blue-600">{formatRupiah(r.amount)}</td>
                        <td className="px-6 py-4 text-slate-800 max-w-xs truncate font-medium">{r.description}</td>
                        <td className="px-6 py-4">
                          {r.status === 'forwarded_to_finance' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 font-bold text-xs rounded-lg border border-blue-200">
                              <Clock className="w-3.5 h-3.5" /> ACC AM (Menunggu Finance)
                            </span>
                          )}
                          {r.status === 'forwarded_by_area_manager' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-200">
                              <ArrowRight className="w-3.5 h-3.5" /> Diserahkan ke Leader
                            </span>
                          )}
                          {r.status === 'forwarded_by_leader' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Diserahkan ke Crew
                            </span>
                          )}
                          {r.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white font-bold text-xs rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Selesai (Crew Terima)
                            </span>
                          )}
                          {r.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 font-bold text-xs rounded-lg border border-red-200">
                              <XCircle className="w-3.5 h-3.5" /> Ditolak
                            </span>
                          )}

                          {r.proof_of_transfer_url && (
                            <button
                              type="button"
                              onClick={() => setSelectedProofUrl(r.proof_of_transfer_url || null)}
                              className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Lihat Bukti Transfer</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <ProofImageLightbox
        imageUrl={selectedProofUrl}
        onClose={() => setSelectedProofUrl(null)}
      />
    </div>
  )
}
