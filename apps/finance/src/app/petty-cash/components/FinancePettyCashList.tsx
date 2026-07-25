'use client'

import React, { useState } from 'react'
import { Wallet, Clock, History, Filter, Store, Building2, CheckCircle2, XCircle, Send, ArrowRight, Loader2, Camera, X, Download } from 'lucide-react'
import { FinanceApprovalModal } from './FinanceApprovalModal'
import { usePettyCashRequests, useProcessPettyCashFinance, useForwardPettyCashFinance } from '@/hooks/usePettyCash'
import { tanggalWaktu, relativeTime } from '@/lib/format'
import type { PettyCashTopup, DisbursementMethod } from '@/lib/types'

const formatRupiah = (val: number) => `Rp ${val.toLocaleString('id-ID')}`

function ProofImageLightbox({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void }) {
  if (!imageUrl) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-suka-ink/80 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-suka-gray-200">
        <div className="p-4 border-b border-suka-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-suka-orange/10 text-suka-orange flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-suka-brown text-sm">Foto Bukti Transfer Finance</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-suka-gray-100 hover:bg-suka-gray-200 text-suka-gray-500 hover:text-suka-brown flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-suka-gray-50">
          <img src={imageUrl} alt="Bukti Transfer" className="max-h-[65vh] w-auto object-contain rounded-2xl shadow-md border border-suka-gray-200" />
        </div>
        <div className="p-4 bg-suka-gray-50 border-t border-suka-gray-100 flex items-center justify-between shrink-0 text-xs">
          <span className="text-suka-gray-500 font-semibold">Lampiran Bukti Transfer Resmi</span>
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            download="Bukti_Transfer_Petty_Cash.jpg"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-suka-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Unduh / Foto Utuh
          </a>
        </div>
      </div>
    </div>
  )
}

export function FinancePettyCashList({ initialRequests }: { initialRequests?: PettyCashTopup[] }) {
  const { data: allRequests, isLoading } = usePettyCashRequests(undefined, initialRequests)
  const processTopup = useProcessPettyCashFinance()
  const forwardTopup = useForwardPettyCashFinance()
  
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')
  const [reviewFilter, setReviewFilter] = useState<'all' | 'unprocessed' | 'ready_handover'>('all')
  const [selectedRequest, setSelectedRequest] = useState<PettyCashTopup | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)

  const allReviewRequests = React.useMemo(() => {
    return allRequests?.filter(r => 
      r.status === 'forwarded_to_finance' || 
      r.status === 'approved_by_finance'
    ) || []
  }, [allRequests])

  const allHistoryRequests = React.useMemo(() => {
    return allRequests?.filter(r => 
      r.status !== 'forwarded_to_finance' && 
      r.status !== 'approved_by_finance'
    ) || []
  }, [allRequests])
  
  const filteredReviewRequests = React.useMemo(() => {
    return allReviewRequests.filter(r => {
      if (reviewFilter === 'unprocessed') return r.status === 'forwarded_to_finance'
      if (reviewFilter === 'ready_handover') return r.status === 'approved_by_finance'
      return true
    })
  }, [allReviewRequests, reviewFilter])

  const requests = activeTab === 'review' ? filteredReviewRequests : allHistoryRequests

  const handleOpenModal = (req: PettyCashTopup) => {
    setSelectedRequest(req)
    setIsModalOpen(true)
  }

  const handleApprove = async (method: DisbursementMethod, cashLocationId?: string, proofOfTransferUrl?: string, approvedAmount?: number, approvalNote?: string) => {
    if (!selectedRequest) return
    await processTopup.mutateAsync({ 
      id: selectedRequest.id, 
      action: 'approve',
      method,
      cashLocationId,
      proofOfTransferUrl,
      approvedAmount,
      approvalNote
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
      <div className="p-12 flex flex-col items-center justify-center text-suka-gray-400 font-medium">
        <Loader2 className="w-6 h-6 animate-spin text-suka-orange" />
        <span className="mt-2 text-xs">Memuat data petty cash...</span>
      </div>
    )
  }

  const unprocessedCount = allReviewRequests.filter(r => r.status === 'forwarded_to_finance').length
  const readyHandoverCount = allReviewRequests.filter(r => r.status === 'approved_by_finance').length

  return (
    <div className="space-y-6 font-sans">
      
      {/* TABS NAVIGATION */}
      <div className="flex border-b border-suka-gray-200 gap-2">
        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'review'
              ? 'border-suka-orange text-suka-orange bg-suka-orange/5 rounded-t-xl'
              : 'border-transparent text-suka-gray-500 hover:text-suka-gray-800 hover:bg-suka-gray-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          Butuh Review & Pencairan ({allReviewRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-suka-orange text-suka-orange bg-suka-orange/5 rounded-t-xl'
              : 'border-transparent text-suka-gray-500 hover:text-suka-gray-800 hover:bg-suka-gray-50'
          }`}
        >
          <History className="w-4 h-4" />
          Riwayat Pencairan ({allHistoryRequests.length})
        </button>
      </div>

      {/* SUB-FILTER CHIPS FOR REVIEW TAB */}
      {activeTab === 'review' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-suka-orange" /> Filter Status:
          </span>
          <button
            onClick={() => setReviewFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              reviewFilter === 'all'
                ? 'bg-suka-brown text-white shadow-sm'
                : 'bg-suka-gray-100 text-suka-gray-600 hover:bg-suka-gray-200'
            }`}
          >
            Semua ({allReviewRequests.length})
          </button>
          <button
            onClick={() => setReviewFilter('unprocessed')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              reviewFilter === 'unprocessed'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Menunggu Acc Finance ({unprocessedCount})
          </button>
          <button
            onClick={() => setReviewFilter('ready_handover')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              reviewFilter === 'ready_handover'
                ? 'bg-suka-orange text-white shadow-sm'
                : 'bg-orange-50 text-suka-orange border border-suka-orange/20 hover:bg-orange-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sudah Dicairkan (Teruskan ke AM) ({readyHandoverCount})
          </button>
        </div>
      )}

      {/* CONTENT LIST */}
      {!requests || requests.length === 0 ? (
        <div className="bg-white rounded-3xl border border-suka-gray-200 p-12 text-center text-suka-gray-400 space-y-2">
          <Wallet className="w-10 h-10 mx-auto text-suka-gray-300" />
          <p className="font-bold text-suka-brown text-base">
            {activeTab === 'review' ? 'Tidak ada pengajuan butuh tindakan' : 'Belum ada riwayat'}
          </p>
          <p className="text-xs text-suka-gray-400">
            {activeTab === 'review' 
              ? 'Belum ada pengajuan petty cash yang diteruskan oleh Area Manager.' 
              : 'Seluruh riwayat pencairan petty cash akan muncul di sini.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-suka-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-suka-gray-50 text-suka-gray-500 text-xs uppercase tracking-wider border-b border-suka-gray-200">
                  <th className="py-3.5 px-6 font-semibold">Tanggal</th>
                  <th className="py-3.5 px-6 font-semibold">Outlet</th>
                  <th className="py-3.5 px-6 font-semibold">Rekening Tujuan</th>
                  <th className="py-3.5 px-6 font-semibold">Nominal</th>
                  <th className="py-3.5 px-6 font-semibold">Alasan / Keperluan</th>
                  <th className="py-3.5 px-6 font-semibold">Status / Bukti</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100 text-sm">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-suka-gray-50/60 transition-colors">
                    <td className="py-4 px-6 text-xs whitespace-nowrap" title={tanggalWaktu(req.created_at)}>
                      <div className="font-bold text-suka-brown text-sm">{relativeTime(req.created_at)}</div>
                      <div className="text-[11px] text-suka-gray-500 font-normal">{tanggalWaktu(req.created_at)}</div>
                    </td>
                    <td className="py-4 px-6 font-bold text-suka-brown">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-suka-orange" />
                        {req.outlet?.name || '-'}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs">
                      {req.bank_name ? (
                        <div className="bg-suka-gray-50 p-2.5 rounded-xl border border-suka-gray-200 inline-block space-y-0.5">
                          <div className="font-bold text-suka-brown flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-suka-orange" /> {req.bank_name} - <span className="font-mono">{req.bank_account_number}</span>
                          </div>
                          <div className="text-[11px] text-suka-gray-500">a.n {req.bank_account_name || '-'}</div>
                        </div>
                      ) : (
                        <span className="text-suka-gray-400 italic text-xs">Belum ada</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-black text-suka-brown whitespace-nowrap text-base">
                      {formatRupiah(req.amount)}
                    </td>
                    <td className="py-4 px-6 text-suka-brown font-medium max-w-xs sm:max-w-md whitespace-pre-wrap break-words leading-relaxed text-xs">
                      {req.reason || req.description}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1.5">
                        {req.status === 'forwarded_to_finance' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-md border border-amber-200">
                            <Clock className="w-3.5 h-3.5" /> Menunggu Acc Finance
                          </span>
                        )}
                        {req.status === 'approved_by_finance' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-suka-orange font-bold text-xs rounded-md border border-suka-orange/20">
                            <CheckCircle2 className="w-3.5 h-3.5 text-suka-orange" /> Dicairkan (Serahkan ke AM)
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

                        {req.proof_of_transfer_url && (
                          <button
                            type="button"
                            onClick={() => setSelectedProofUrl(req.proof_of_transfer_url || null)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-lg border border-emerald-200 transition-colors shadow-2xs cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-emerald-600" /> Lihat Bukti Transfer
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      {req.status === 'forwarded_to_finance' && activeTab === 'review' && (
                        <button
                          onClick={() => handleOpenModal(req)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-suka-orange hover:bg-orange-600 text-white rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer"
                        >
                          <Wallet className="w-4 h-4" />
                          Proses / Acc
                        </button>
                      )}
                      {req.status === 'approved_by_finance' && activeTab === 'review' && (
                        <button
                          onClick={() => handleForwardToAreaManager(req)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer"
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

      <ProofImageLightbox
        imageUrl={selectedProofUrl}
        onClose={() => setSelectedProofUrl(null)}
      />
    </div>
  )
}
