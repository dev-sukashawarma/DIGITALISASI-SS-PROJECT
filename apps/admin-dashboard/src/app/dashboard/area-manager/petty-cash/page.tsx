'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle2, Clock, Store, ShieldCheck, Send, History, Filter, XCircle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatRupiah } from '@/lib/validations'
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
  outlet?: { name: string; region?: string | null } | null
}

export default function AreaManagerPettyCashPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<TopupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  // Tabs: 'review' | 'history'
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')

  // Sub-filters
  const [reviewFilter, setReviewFilter] = useState<'all' | 'unapproved' | 'ready_handover'>('all')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'acc_finance' | 'forwarded_leader' | 'completed' | 'rejected'>('all')

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    setLoading(true)
    try {
      const res = await getAreaManagerPettyCashTopups()
      if (!res.success) throw new Error(res.error)

      if (res.data) {
        // Filter in JS to strictly show BOGOR region outlets (or null/unassigned HQ)
        const bogorRequests = res.data
          .filter((r: any) => {
            const reg = r.outlets?.region
            return !reg || reg.toUpperCase() === 'BOGOR'
          })
          .map((r: any) => ({
            ...r,
            outlet: r.outlets ? { name: r.outlets.name, region: r.outlets.region } : null
          }))

        setRequests(bogorRequests)
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Gagal memuat data petty cash: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    if (!confirm('Setujui pengajuan ini dan terusan ke Finance?')) return
    setIsProcessing(id)
    try {
      const { error } = await supabase.rpc('area_manager_process_petty_cash', {
        p_topup_id: id,
        p_action: 'approve'
      })
      if (error) throw error

      toast.success('Pengajuan disetujui & diteruskan ke Finance!')
      await loadRequests()
    } catch (err: any) {
      toast.error('Gagal menyetujui pengajuan: ' + err.message)
    } finally {
      setIsProcessing(null)
    }
  }

  async function handleReject(id: string) {
    if (!confirm('Tolak pengajuan ini? Status akan menjadi Ditolak.')) return
    setIsProcessing(id)
    try {
      const { error } = await supabase.rpc('area_manager_process_petty_cash', {
        p_topup_id: id,
        p_action: 'reject'
      })
      if (error) throw error

      toast.error('Pengajuan telah ditolak.')
      await loadRequests()
    } catch (err: any) {
      toast.error('Gagal menolak pengajuan: ' + err.message)
    } finally {
      setIsProcessing(null)
    }
  }

  async function handleForwardToLeader(id: string) {
    if (!confirm('Teruskan penyerahan dana ke Leader Cabang?')) return
    setIsProcessing(id)
    try {
      const { error } = await supabase.rpc('area_manager_forward_funds', {
        p_topup_id: id
      })
      if (error) throw error

      toast.success('Dana berhasil diserahkan ke Leader!')
      await loadRequests()
    } catch (err: any) {
      toast.error('Gagal penyerahan dana: ' + err.message)
    } finally {
      setIsProcessing(null)
    }
  }

  // Categories
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

  // Sub-filtered Review
  const filteredReviewRequests = allReviewRequests.filter(r => {
    if (reviewFilter === 'unapproved') {
      return r.status === 'pending' || r.status === 'forwarded_to_area_manager'
    }
    if (reviewFilter === 'ready_handover') {
      return r.status === 'approved_by_finance' || r.status === 'forwarded_by_finance'
    }
    return true
  })

  // Sub-filtered History
  const filteredHistoryRequests = allHistoryRequests.filter(r => {
    if (historyFilter === 'acc_finance') return r.status === 'forwarded_to_finance'
    if (historyFilter === 'forwarded_leader') return r.status === 'forwarded_by_area_manager'
    if (historyFilter === 'completed') return r.status === 'forwarded_by_leader' || r.status === 'completed'
    if (historyFilter === 'rejected') return r.status === 'rejected'
    return true
  })

  // Counts for Sub-filters
  const unapprovedCount = allReviewRequests.filter(r => r.status === 'pending' || r.status === 'forwarded_to_area_manager').length
  const readyHandoverCount = allReviewRequests.filter(r => r.status === 'approved_by_finance' || r.status === 'forwarded_by_finance').length

  const accFinanceCount = allHistoryRequests.filter(r => r.status === 'forwarded_to_finance').length
  const forwardedLeaderCount = allHistoryRequests.filter(r => r.status === 'forwarded_by_area_manager').length
  const completedCount = allHistoryRequests.filter(r => r.status === 'forwarded_by_leader' || r.status === 'completed').length
  const rejectedCount = allHistoryRequests.filter(r => r.status === 'rejected').length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
          <ShieldCheck className="w-7 h-7 text-indigo-600" />
          Dashboard Area Manager - Approval Petty Cash (Wilayah BOGOR)
        </h1>
        <p className="text-sm text-slate-500 mt-1">Review pengajuan dana dari cabang Wilayah Bogor dan kelola serah terima ke Leader.</p>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'review'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          Butuh Review & Serah Terima ({allReviewRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <History className="w-4 h-4" />
          Riwayat Pengajuan Area Manager ({allHistoryRequests.length})
        </button>
      </div>

      {/* TAB 1: REVIEW / ACTION NEEDED */}
      {activeTab === 'review' && (
        <section className="space-y-4">
          {/* Sub-filter chips for Review */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            <button
              onClick={() => setReviewFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reviewFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({allReviewRequests.length})
            </button>
            <button
              onClick={() => setReviewFilter('unapproved')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reviewFilter === 'unapproved'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              ⏳ Belum di-ACC ({unapprovedCount})
            </button>
            <button
              onClick={() => setReviewFilter('ready_handover')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reviewFilter === 'ready_handover'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              🟢 Siap Diserahkan ({readyHandoverCount})
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400 font-medium">Memuat data...</div>
            ) : filteredReviewRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                Tidak ada pengajuan pada kategori ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredReviewRequests.map((req) => (
                  <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-slate-400" /> {req.outlet?.name || 'Unknown Outlet'}
                        </span>
                        {(req.status === 'pending' || req.status === 'forwarded_to_area_manager') && (
                          <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                            BELUM DI-ACC (MENUNGGU AM)
                          </span>
                        )}
                        {(req.status === 'approved_by_finance' || req.status === 'forwarded_by_finance') && (
                          <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                            SUDAH DICAIRKAN FINANCE (SERAHKAN KE LEADER)
                          </span>
                        )}
                      </div>

                      <p className="font-bold text-slate-900 text-base">{req.description}</p>
                      
                      {/* Bank Info */}
                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 inline-block">
                        <span className="font-bold text-slate-700">Rekening Tujuan: </span>
                        {req.bank_name ? (
                          <span>{req.bank_name} - <b>{req.bank_account_number}</b> (a.n {req.bank_account_name || '-'})</span>
                        ) : (
                          <span className="italic text-slate-400">Belum ada</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Nominal</p>
                        <p className="text-xl font-black text-blue-600">{formatRupiah(req.amount)}</p>
                      </div>

                      <div className="flex gap-2">
                        {(req.status === 'pending' || req.status === 'forwarded_to_area_manager') && (
                          <>
                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={isProcessing === req.id}
                              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
                            >
                              Tolak
                            </button>
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={isProcessing === req.id}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Acc & Ke Finance
                            </button>
                          </>
                        )}

                        {(req.status === 'approved_by_finance' || req.status === 'forwarded_by_finance') && (
                          <button
                            onClick={() => handleForwardToLeader(req.id)}
                            disabled={isProcessing === req.id}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
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
          {/* Sub-filter chips for History */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filter Riwayat:
            </span>
            <button
              onClick={() => setHistoryFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                historyFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({allHistoryRequests.length})
            </button>
            <button
              onClick={() => setHistoryFilter('acc_finance')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                historyFilter === 'acc_finance'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              Sudah di-ACC (Ke Finance) ({accFinanceCount})
            </button>
            <button
              onClick={() => setHistoryFilter('forwarded_leader')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                historyFilter === 'forwarded_leader'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Diserahkan ke Leader ({forwardedLeaderCount})
            </button>
            <button
              onClick={() => setHistoryFilter('completed')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                historyFilter === 'completed'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
              }`}
            >
              ✅ Selesai (Crew Terima) ({completedCount})
            </button>
            <button
              onClick={() => setHistoryFilter('rejected')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                historyFilter === 'rejected'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
              }`}
            >
              ❌ Ditolak ({rejectedCount})
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-3 font-semibold">Outlet</th>
                    <th className="px-6 py-3 font-semibold">Nominal</th>
                    <th className="px-6 py-3 font-semibold">Alasan / Keperluan</th>
                    <th className="px-6 py-3 font-semibold">Status Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-medium">
                        Memuat data riwayat...
                      </td>
                    </tr>
                  ) : filteredHistoryRequests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                        Tidak ada riwayat pengajuan pada kategori ini.
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Store className="w-4 h-4 text-slate-400" />
                            {r.outlet?.name || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-black text-blue-600">{formatRupiah(r.amount)}</td>
                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{r.description}</td>
                        <td className="px-6 py-4">
                          {r.status === 'forwarded_to_finance' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-md border border-blue-200">
                              <Clock className="w-3.5 h-3.5" /> Sudah di-ACC AM (Menunggu Finance)
                            </span>
                          )}
                          {r.status === 'forwarded_by_area_manager' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-md border border-emerald-200">
                              <ArrowRight className="w-3.5 h-3.5" /> Diserahkan ke Leader
                            </span>
                          )}
                          {r.status === 'forwarded_by_leader' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-md border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Diserahkan ke Crew (Saldo +)
                            </span>
                          )}
                          {r.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white font-bold text-xs rounded-md">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Selesai (Crew Terima)
                            </span>
                          )}
                          {r.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 font-bold text-xs rounded-md border border-red-200">
                              <XCircle className="w-3.5 h-3.5" /> Ditolak
                            </span>
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
    </div>
  )
}
