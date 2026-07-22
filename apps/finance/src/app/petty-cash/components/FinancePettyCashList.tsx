'use client'

import React, { useState } from 'react'
import { Wallet, Clock, History, Filter, Store, Building2, CheckCircle2, XCircle, Send, ArrowRight, Loader2 } from 'lucide-react'
import { FinanceApprovalModal } from './FinanceApprovalModal'
import { usePettyCashRequests, useProcessPettyCashFinance, useForwardPettyCashFinance } from '@/hooks/usePettyCash'
import { tanggalWaktu } from '@/lib/format'
import type { PettyCashTopup, DisbursementMethod } from '@/lib/types'

const formatRupiah = (val: number) => `Rp ${val.toLocaleString('id-ID')}`

export function FinancePettyCashList({ initialRequests }: { initialRequests?: PettyCashTopup[] }) {
  const { data: allRequests, isLoading } = usePettyCashRequests(undefined, initialRequests)
  const processTopup = useProcessPettyCashFinance()
  const forwardTopup = useForwardPettyCashFinance()
  
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')
  const [reviewFilter, setReviewFilter] = useState<'all' | 'unprocessed' | 'ready_handover'>('all')
  const [selectedRequest, setSelectedRequest] = useState<PettyCashTopup | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const allReviewRequests = allRequests?.filter(r => 
    r.status === 'forwarded_to_finance' || 
    r.status === 'approved_by_finance'
  ) || []

  const allHistoryRequests = allRequests?.filter(r => 
    r.status !== 'forwarded_to_finance' && 
    r.status !== 'approved_by_finance'
  ) || []
  
  const filteredReviewRequests = allReviewRequests.filter(r => {
    if (reviewFilter === 'unprocessed') return r.status === 'forwarded_to_finance'
    if (reviewFilter === 'ready_handover') return r.status === 'approved_by_finance'
    return true
  })

  const requests = activeTab === 'review' ? filteredReviewRequests : allHistoryRequests

  const handleOpenModal = (req: PettyCashTopup) => {
    setSelectedRequest(req)
    setIsModalOpen(true)
  }

  const handleApprove = async (method: DisbursementMethod, cashLocationId?: string, proofOfTransferUrl?: string) => {
    if (!selectedRequest) return
    await processTopup.mutateAsync({ 
      id: selectedRequest.id, 
      action: 'approve',
      method,
      cashLocationId,
      proofOfTransferUrl
    })
    setIsModalOpen(false)
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    await processTopup.mutateAsync({ id: selectedRequest.id, action: 'reject' })
    setIsModalOpen(false)
  }

  const handleForwardToAreaManager = async (req: PettyCashTopup) => {
    if (confirm('Konfirmasi penyerahan dana dari Finance ke Area Manager?')) {
      await forwardTopup.mutateAsync({ id: req.id })
    }
  }

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-400 font-medium">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="mt-2 text-xs">Memuat data petty cash...</span>
      </div>
    )
  }

  const unprocessedCount = allReviewRequests.filter(r => r.status === 'forwarded_to_finance').length
  const readyHandoverCount = allReviewRequests.filter(r => r.status === 'approved_by_finance').length

  return (
    <div className="space-y-6">
      
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
          Butuh Review & Pencairan ({allReviewRequests.length})
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
          Riwayat Pencairan ({allHistoryRequests.length})
        </button>
      </div>

      {/* SUB-FILTER CHIPS FOR REVIEW TAB */}
      {activeTab === 'review' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filter Status:
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
            onClick={() => setReviewFilter('unprocessed')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              reviewFilter === 'unprocessed'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            ⏳ Menunggu Acc Finance ({unprocessedCount})
          </button>
          <button
            onClick={() => setReviewFilter('ready_handover')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              reviewFilter === 'ready_handover'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            🟢 Sudah Dicairkan (Teruskan ke AM) ({readyHandoverCount})
          </button>
        </div>
      )}

      {/* CONTENT LIST */}
      {!requests || requests.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
          <Wallet className="w-10 h-10 mx-auto text-slate-300" />
          <p className="font-bold text-slate-700 text-base">
            {activeTab === 'review' ? 'Tidak ada pengajuan butuh tindakan' : 'Belum ada riwayat'}
          </p>
          <p className="text-xs text-slate-400">
            {activeTab === 'review' 
              ? 'Belum ada pengajuan petty cash yang diteruskan oleh Area Manager.' 
              : 'Seluruh riwayat pencairan petty cash akan muncul di sini.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-6 font-semibold">Tanggal</th>
                  <th className="py-3.5 px-6 font-semibold">Outlet</th>
                  <th className="py-3.5 px-6 font-semibold">Rekening Tujuan</th>
                  <th className="py-3.5 px-6 font-semibold">Nominal</th>
                  <th className="py-3.5 px-6 font-semibold">Alasan / Keperluan</th>
                  <th className="py-3.5 px-6 font-semibold">Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6 text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {tanggalWaktu(req.created_at)}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-slate-400" />
                        {req.outlet?.name || '-'}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs">
                      {req.bank_name ? (
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 inline-block space-y-0.5">
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500" /> {req.bank_name} - <span className="font-mono">{req.bank_account_number}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">a.n {req.bank_account_name || '-'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Belum ada</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-black text-indigo-600 whitespace-nowrap text-base">
                      {formatRupiah(req.amount)}
                    </td>
                    <td className="py-4 px-6 text-slate-700 max-w-xs truncate font-medium">
                      {req.reason || req.description}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {req.status === 'forwarded_to_finance' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-md border border-amber-200">
                          <Clock className="w-3.5 h-3.5" /> Menunggu Acc Finance
                        </span>
                      )}
                      {req.status === 'approved_by_finance' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-md border border-indigo-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> Dicairkan (Serahkan ke AM)
                        </span>
                      )}
                      {req.status === 'forwarded_by_finance' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-md border border-blue-200">
                          <ArrowRight className="w-3.5 h-3.5" /> Diserahkan ke Area Manager
                        </span>
                      )}
                      {req.status === 'forwarded_by_area_manager' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-md border border-emerald-200">
                          <ArrowRight className="w-3.5 h-3.5" /> Diserahkan ke Leader
                        </span>
                      )}
                      {req.status === 'forwarded_by_leader' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-md border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Diserahkan ke Crew
                        </span>
                      )}
                      {req.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white font-bold text-xs rounded-md">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 font-bold text-xs rounded-md border border-red-200">
                          <XCircle className="w-3.5 h-3.5" /> Ditolak
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      {req.status === 'forwarded_to_finance' && activeTab === 'review' && (
                        <button
                          onClick={() => handleOpenModal(req)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
                        >
                          <Wallet className="w-4 h-4" />
                          Proses / Acc
                        </button>
                      )}
                      {req.status === 'approved_by_finance' && activeTab === 'review' && (
                        <button
                          onClick={() => handleForwardToAreaManager(req)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
                        >
                          <Send className="w-4 h-4" />
                          Serahkan ke AM
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedRequest && (
        <FinanceApprovalModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          request={selectedRequest}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  )
}
