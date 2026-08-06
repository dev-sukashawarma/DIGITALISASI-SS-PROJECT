'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Wallet, Clock, History, Filter, Store, CheckCircle2, XCircle, Send, ArrowRight, Loader2, Camera, X, Download, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { FinanceApprovalModal } from './FinanceApprovalModal'
import { usePettyCashRequests, useProcessPettyCashFinance, useForwardPettyCashFinance } from '@/hooks/usePettyCash'
import { tanggalWaktu } from '@/lib/format'
import type { PettyCashTopup, DisbursementMethod } from '@/lib/types'

const formatRupiah = (val: number) => `Rp ${val.toLocaleString('id-ID')}`

function parseFinanceNote(description?: string | null) {
  if (!description) return { mainReason: '', financeNote: null }

  const splitMarker = '📌 ['
  if (description.includes(splitMarker)) {
    const parts = description.split(splitMarker)
    const mainReason = parts[0].trim()
    const financeNote = parts[1].replace(/\]$/, '').trim()
    return { mainReason, financeNote }
  }

  if (description.includes('(Catatan Finance:')) {
    const parts = description.split('(Catatan Finance:')
    const mainReason = parts[0].trim()
    const financeNote = 'Catatan Finance:' + parts[1].replace(/\)$/, '').trim()
    return { mainReason, financeNote }
  }

  return { mainReason: description, financeNote: null }
}

function ProofImageLightbox({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void }) {
  const [imgError, setImgError] = useState(false)

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
            onClick={() => { setImgError(false); onClose(); }}
            className="w-8 h-8 rounded-full bg-suka-gray-100 hover:bg-suka-gray-200 text-suka-gray-500 hover:text-suka-brown flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-suka-gray-50 min-h-[250px]">
          {imgError ? (
            <div className="text-center p-6 text-suka-gray-500">
              <Camera className="w-10 h-10 mx-auto text-suka-gray-300 mb-2" />
              <p className="font-bold text-sm text-suka-brown">Gambar tidak dapat ditampilkan langsung</p>
              <p className="text-xs text-suka-gray-400 mt-1 mb-3">Klik tombol di bawah untuk membuka gambar secara utuh di tab baru.</p>
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-suka-orange text-white rounded-xl font-bold text-xs hover:bg-orange-600 transition-colors shadow-sm"
              >
                Buka Foto Utuh
              </a>
            </div>
          ) : (
            <img 
              src={imageUrl} 
              alt="Bukti Transfer" 
              onError={() => setImgError(true)}
              className="max-h-[65vh] w-auto object-contain rounded-2xl shadow-md border border-suka-gray-200" 
            />
          )}
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
  const router = useRouter()
  const { data: allRequests, isLoading } = usePettyCashRequests(undefined, initialRequests)
  const processTopup = useProcessPettyCashFinance()
  const forwardTopup = useForwardPettyCashFinance()
  
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')
  const [reviewFilter, setReviewFilter] = useState<'all' | 'waiting_am' | 'unprocessed' | 'ready_handover'>('all')
  const [selectedRequest, setSelectedRequest] = useState<PettyCashTopup | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOutletFilter, setSelectedOutletFilter] = useState('all')

  const allReviewRequests = React.useMemo(() => {
    return allRequests?.filter(r => 
      r.status === 'forwarded_to_area_manager' ||
      r.status === 'forwarded_to_finance' || 
      r.status === 'approved_by_finance'
    ) || []
  }, [allRequests])

  const allHistoryRequests = React.useMemo(() => {
    return allRequests?.filter(r => 
      r.status !== 'forwarded_to_area_manager' &&
      r.status !== 'forwarded_to_finance' && 
      r.status !== 'approved_by_finance'
    ) || []
  }, [allRequests])
  
  const uniqueOutlets = React.useMemo(() => {
    const outlets = new Map<string, { id: string, name: string }>()
    allRequests?.forEach(r => {
      if (r.outlet_id && r.outlet) {
        outlets.set(r.outlet_id, { id: r.outlet_id, name: r.outlet.name })
      }
    })
    return Array.from(outlets.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allRequests])

  const filteredRequests = React.useMemo(() => {
    let source = activeTab === 'review' ? allReviewRequests : allHistoryRequests

    // Filter by Review Status
    if (activeTab === 'review') {
      if (reviewFilter === 'waiting_am') source = source.filter(r => r.status === 'forwarded_to_area_manager')
      if (reviewFilter === 'unprocessed') source = source.filter(r => r.status === 'forwarded_to_finance')
      if (reviewFilter === 'ready_handover') source = source.filter(r => r.status === 'approved_by_finance')
    }

    // Filter by Outlet
    if (selectedOutletFilter !== 'all') {
      source = source.filter(r => r.outlet_id === selectedOutletFilter)
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      source = source.filter(r => {
        const matchOutlet = r.outlet?.name?.toLowerCase().includes(q)
        const reasonStr = (r.reason || '') + ' ' + (r.description || '')
        const matchReason = reasonStr.toLowerCase().includes(q)
        const matchBank = r.bank_name?.toLowerCase().includes(q) || r.bank_account_name?.toLowerCase().includes(q)
        return matchOutlet || matchReason || matchBank
      })
    }

    return source
  }, [activeTab, allReviewRequests, allHistoryRequests, reviewFilter, selectedOutletFilter, searchQuery])

  const requests = filteredRequests

  const handleOpenModal = (req: PettyCashTopup) => {
    setSelectedRequest(req)
    setIsModalOpen(true)
  }

  const handleApprove = async (method: DisbursementMethod, cashLocationId?: string, proofFile?: File | null, approvedAmount?: number, approvalNote?: string) => {
    if (!selectedRequest) return
    try {
      await processTopup.mutateAsync({ 
        id: selectedRequest.id, 
        action: 'approve',
        method,
        cashLocationId,
        proofFile,
        approvedAmount,
        approvalNote
      })
      toast.success('Pencairan Petty Cash berhasil diproses!')
      setIsModalOpen(false)
      router.refresh()
    } catch (err: any) {
      console.error('Error approving topup:', err)
      toast.error(err.message || 'Gagal memproses pencairan')
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    try {
      await processTopup.mutateAsync({ id: selectedRequest.id, action: 'reject' })
      toast.success('Pengajuan Petty Cash ditolak.')
      setIsModalOpen(false)
      router.refresh()
    } catch (err: any) {
      console.error('Error rejecting topup:', err)
      toast.error(err.message || 'Gagal menolak pengajuan')
    }
  }

  const handleForwardToAreaManager = async (req: PettyCashTopup) => {
    if (confirm('Konfirmasi penyerahan dana dari Finance ke Area Manager?')) {
      try {
        await forwardTopup.mutateAsync({ id: req.id })
        toast.success('Dana berhasil diserahkan ke Area Manager!')
        router.refresh()
      } catch (err: any) {
        toast.error(err.message || 'Gagal meneruskan dana')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-400 font-medium">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="mt-2 text-xs font-semibold">Memuat data petty cash...</span>
      </div>
    )
  }

  const waitingAMCount = allReviewRequests.filter(r => r.status === 'forwarded_to_area_manager').length
  const unprocessedCount = allReviewRequests.filter(r => r.status === 'forwarded_to_finance').length
  const readyHandoverCount = allReviewRequests.filter(r => r.status === 'approved_by_finance').length

  return (
    <div className="space-y-6 font-sans">
      
      {/* TABS NAVIGATION */}
      <div className="inline-flex bg-white/60 backdrop-blur-xl rounded-2xl border border-suka-brown/5 p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'review'
              ? 'bg-suka-orange/10 text-suka-orange shadow-sm'
              : 'text-suka-gray-500 hover:text-suka-brown hover:bg-white/50'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          Butuh Review & Pencairan
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'review' ? 'bg-orange-100 text-suka-orange' : 'bg-suka-brown/10 text-suka-brown'
          }`}>
            {allReviewRequests.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-suka-orange/10 text-suka-orange shadow-sm'
              : 'text-suka-gray-500 hover:text-suka-brown hover:bg-white/50'
          }`}
        >
          <History className="w-4 h-4 text-blue-500" />
          Riwayat Pencairan
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'history' ? 'bg-blue-100 text-blue-800' : 'bg-suka-brown/10 text-suka-brown'
          }`}>
            {allHistoryRequests.length}
          </span>
        </button>
      </div>

      {/* MAIN CONTENT CONTAINER */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden flex flex-col">
        
        {/* FILTER & SEARCH BAR */}
        <div className="p-4 sm:px-6 border-b border-suka-brown/5 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 bg-white/40">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {activeTab === 'review' && (
            <>
              <span className="text-xs font-semibold text-suka-gray-400 uppercase tracking-wider flex items-center gap-1.5 px-2">
                <Filter className="w-3.5 h-3.5 text-amber-500" /> Filter:
              </span>
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                  reviewFilter === 'all'
                    ? 'bg-suka-brown text-white border-suka-brown shadow-sm'
                    : 'bg-white text-suka-brown/70 border-suka-brown/20 hover:border-suka-brown hover:text-suka-brown'
                }`}
              >
                Semua ({allReviewRequests.length})
              </button>
              <button
                onClick={() => setReviewFilter('waiting_am')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                  reviewFilter === 'waiting_am'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                    : 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Menunggu Acc AM ({waitingAMCount})
              </button>
              <button
                onClick={() => setReviewFilter('unprocessed')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                  reviewFilter === 'unprocessed'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                    : 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Menunggu Acc Finance ({unprocessedCount})
              </button>
              <button
                onClick={() => setReviewFilter('ready_handover')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                  reviewFilter === 'ready_handover'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Sudah Dicairkan ({readyHandoverCount})
              </button>
              <div className="w-px h-6 bg-suka-brown/10 mx-1 hidden sm:block"></div>
            </>
          )}

          {/* OUTLET FILTER */}
          <div className="relative">
            <Store className="w-3.5 h-3.5 absolute left-3 top-2.5 text-suka-gray-400" />
            <select
              value={selectedOutletFilter}
              onChange={(e) => setSelectedOutletFilter(e.target.value)}
              className="pl-8 pr-8 py-1.5 bg-suka-cream/50 border border-suka-brown/20 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange text-suka-brown text-xs font-bold rounded-xl outline-none appearance-none cursor-pointer transition-all"
            >
              <option value="all">Semua Outlet</option>
              {uniqueOutlets.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {/* Custom select arrow */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-suka-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-suka-gray-400" />
          <input
            type="text"
            placeholder="Cari outlet, alasan, bank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-suka-cream/50 border border-suka-brown/20 text-suka-brown text-xs font-bold rounded-xl focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange placeholder-suka-gray-400 transition-all"
          />
        </div>
      </div>

      {/* CONTENT LIST */}
      {!requests || requests.length === 0 ? (
        <div className="p-16 text-center space-y-3 bg-white/40 w-full flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-16 h-16 rounded-3xl bg-orange-50/80 border border-orange-100 text-suka-orange flex items-center justify-center shadow-sm">
            <Wallet className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-suka-brown text-base">
              {activeTab === 'review' ? 'Tidak Ada Pengajuan Butuh Tindakan' : 'Belum Ada Riwayat'}
            </h3>
            <p className="text-xs text-suka-gray-400 font-medium mt-1 leading-relaxed">
              {activeTab === 'review' 
                ? 'Belum ada pengajuan petty cash baru yang diteruskan oleh Area Manager.' 
                : 'Seluruh riwayat pencairan petty cash akan tercatat di sini.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm border-collapse min-w-[750px] whitespace-nowrap">
            <thead>
              <tr className="bg-suka-cream/20 text-suka-gray-500 border-b border-suka-brown/5">
                  <th className="py-3 px-5 font-semibold">Tanggal</th>
                  <th className="py-3 px-5 font-semibold">Outlet</th>
                  <th className="py-3 px-5 font-semibold">Rekening Tujuan</th>
                  <th className="py-3 px-5 font-semibold">Nominal</th>
                  <th className="py-3 px-5 font-semibold">Alasan / Keperluan</th>
                  <th className="py-3 px-5 font-semibold">Status / Bukti</th>
                  <th className="py-3 px-5 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <motion.tbody 
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.05 } },
                  hidden: {},
                }}
                className="divide-y divide-suka-brown/5"
              >
                {requests.map((req) => (
                  <motion.tr 
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                    }}
                    key={req.id} 
                    className="hover:bg-orange-50/30 transition-colors group"
                  >
                    <td className="py-3 px-5 whitespace-nowrap text-suka-gray-500" title={tanggalWaktu(req.created_at)}>
                      {tanggalWaktu(req.created_at)}
                    </td>
                    <td className="py-3 px-5 font-semibold text-suka-ink">
                      {req.outlet?.name || '-'}
                    </td>
                    <td className="py-3 px-5">
                      {req.bank_name ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-suka-ink">{req.bank_name} - {req.bank_account_number}</span>
                          <span className="text-xs text-suka-gray-500">a.n {req.bank_account_name || '-'}</span>
                        </div>
                      ) : (
                        <span className="text-suka-gray-400 italic">Belum ada</span>
                      )}
                    </td>
                    <td className="py-3 px-5 font-bold text-suka-ink group-hover:scale-105 transition-transform origin-left">
                      {formatRupiah(req.amount)}
                    </td>
                    <td className="py-3 px-5 text-suka-gray-600 max-w-xs sm:max-w-md whitespace-pre-wrap break-words leading-relaxed">
                      {(() => {
                        const { mainReason, financeNote } = parseFinanceNote(req.reason || req.description)
                        return (
                          <div className="space-y-1">
                            <div>{mainReason}</div>
                            {financeNote && (
                              <div className="bg-amber-50 border border-amber-200/80 text-amber-900 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold mt-1 shadow-2xs">
                                📌 {financeNote}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="py-3 px-5 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1.5">
                        {req.status === 'forwarded_to_area_manager' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 font-medium text-xs rounded-lg border border-amber-200/80">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Menunggu Acc AM
                          </span>
                        )}
                        {req.status === 'forwarded_to_finance' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 font-medium text-xs rounded-lg border border-amber-200/80">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Menunggu Acc Finance
                          </span>
                        )}
                        {req.status === 'approved_by_finance' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 font-medium text-xs rounded-lg border border-emerald-200/80">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Dicairkan (Teruskan ke AM)
                          </span>
                        )}
                        {req.status === 'forwarded_by_finance' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-800 font-medium text-xs rounded-lg border border-blue-200/80">
                            <ArrowRight className="w-3.5 h-3.5 text-blue-600" /> Diserahkan ke AM
                          </span>
                        )}
                        {req.status === 'forwarded_by_area_manager' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-800 font-medium text-xs rounded-lg border border-indigo-200/80">
                            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" /> Diserahkan ke Leader
                          </span>
                        )}
                        {req.status === 'forwarded_by_leader' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 font-medium text-xs rounded-lg border border-purple-200/80">
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" /> Diserahkan ke Crew
                          </span>
                        )}
                        {req.status === 'completed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 text-white font-medium text-xs rounded-lg shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 font-medium text-xs rounded-lg border border-red-200/80">
                            <XCircle className="w-3.5 h-3.5 text-red-500" /> Ditolak
                          </span>
                        )}

                        {req.proof_of_transfer_url && (
                          <button
                            type="button"
                            onClick={() => setSelectedProofUrl(req.proof_of_transfer_url || null)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium text-xs rounded-lg border border-emerald-200/80 transition-colors shadow-2xs cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-emerald-600" /> Lihat Bukti Transfer
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      {req.status === 'forwarded_to_finance' && activeTab === 'review' && (
                        <button
                          onClick={() => handleOpenModal(req)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-suka-brown to-suka-ink hover:from-suka-ink hover:to-black text-white rounded-lg font-medium text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                          <Wallet className="w-4 h-4" />
                          Proses / Acc
                        </button>
                      )}
                      {req.status === 'approved_by_finance' && activeTab === 'review' && (
                        <button
                          onClick={() => handleForwardToAreaManager(req)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          Serahkan ke AM
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
      )}
      </div>

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
