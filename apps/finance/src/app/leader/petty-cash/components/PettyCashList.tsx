'use client'

import React, { useState, useMemo } from 'react'
import { Spinner, EmptyState } from '@suka/design-system'
import { Camera, X, Download, Search, Calendar, Store, Building2, Clock, CheckCircle2, Send, XCircle, Plus, FileSpreadsheet, FileText } from 'lucide-react'
import { ApprovalModal } from '@/components/petty-cash/ApprovalModal'
import { CreateTopupModal } from './CreateTopupModal'
import { usePettyCashRequests, useProcessPettyCashLeader, useForwardPettyCashLeader } from '@/hooks/usePettyCash'
import { relativeTime } from '@/lib/format'
import type { PettyCashTopup } from '@/lib/types'
import { exportPettyCashCSV, exportPettyCashPDF } from '@/lib/exportPettyCash'

function formatDateTime(iso: string) {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', 
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

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
            <Download className="w-3.5 h-3.5" /> Unduh Foto Utuh
          </a>
        </div>
      </div>
    </div>
  )
}

export function PettyCashList({ initialRequests }: { initialRequests?: PettyCashTopup[] }) {
  const { data: allRequests, isLoading } = usePettyCashRequests(undefined, initialRequests)
  const processTopup = useProcessPettyCashLeader()
  const forwardTopup = useForwardPettyCashLeader()
  
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<PettyCashTopup | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)

  const reviewRequests = allRequests?.filter(r => 
    r.status === 'pending' || 
    r.status === 'forwarded_to_area_manager' || 
    r.status === 'forwarded_by_area_manager'
  ) || []
  
  const historyRequests = allRequests?.filter(r => 
    r.status !== 'pending' && 
    r.status !== 'forwarded_to_area_manager' && 
    r.status !== 'forwarded_by_area_manager'
  ) || []
  
  const baseRequests = activeTab === 'review' ? reviewRequests : historyRequests

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return baseRequests
    const q = searchQuery.toLowerCase()
    return baseRequests.filter(r => {
      const outletName = (r.outlet?.name || '').toLowerCase()
      const desc = (r.reason || r.description || '').toLowerCase()
      const bank = (r.bank_name || '').toLowerCase()
      const acc = (r.bank_account_number || '').toLowerCase()
      const amountStr = r.amount.toString()
      return outletName.includes(q) || desc.includes(q) || bank.includes(q) || acc.includes(q) || amountStr.includes(q)
    })
  }, [baseRequests, searchQuery])

  const handleOpenModal = (req: PettyCashTopup) => {
    setSelectedRequest(req)
    setIsModalOpen(true)
  }

  // suppress TS6133 if unused in current view mode
  void handleOpenModal;

  const handleApprove = async () => {
    if (!selectedRequest) return
    await processTopup.mutateAsync({ id: selectedRequest.id, action: 'approve' })
    setIsModalOpen(false)
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    await processTopup.mutateAsync({ id: selectedRequest.id, action: 'reject' })
    setIsModalOpen(false)
  }

  const handleForward = async (req: PettyCashTopup) => {
    if (confirm('Anda yakin ingin menyerahkan dana ini ke Crew? Saldo Petty Cash Outlet akan bertambah.')) {
      await forwardTopup.mutateAsync({ id: req.id })
    }
  }

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Spinner /></div>
  }

  return (
    <div className="space-y-5 font-sans">
      
      {/* TABS & ACTION BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-suka-gray-200/90 shadow-2xs">
        <div className="flex border-b sm:border-b-0 border-suka-gray-200 space-x-1">
          <button
            className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'review' 
                ? 'bg-suka-orange/10 text-suka-orange border border-suka-orange/20 shadow-2xs' 
                : 'text-suka-gray-500 hover:text-suka-gray-800 hover:bg-suka-gray-50'
            }`}
            onClick={() => setActiveTab('review')}
          >
            <span>Aktif / Butuh Serah Terima</span>
            {reviewRequests.length > 0 ? (
              <span className="inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full min-w-[20px] h-5 px-1.5 shadow-sm">
                {reviewRequests.length}
              </span>
            ) : (
              <span>(0)</span>
            )}
          </button>
          <button
            className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl transition-all ${
              activeTab === 'history' 
                ? 'bg-suka-brown text-white shadow-2xs' 
                : 'text-suka-gray-500 hover:text-suka-gray-800 hover:bg-suka-gray-50'
            }`}
            onClick={() => setActiveTab('history')}
          >
            Riwayat ({historyRequests.length})
          </button>
        </div>

        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-suka-orange hover:bg-orange-600 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-sm shadow-orange-500/20 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Buat Pengajuan Top Up</span>
        </button>
      </div>

      {/* SEARCH BAR & EXPORT BUTTONS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-suka-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama outlet, alasan, bank, atau nominal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-12 py-2.5 bg-white border border-suka-gray-200 rounded-2xl text-xs font-semibold text-suka-brown placeholder-suka-gray-400 focus:ring-2 focus:ring-suka-orange focus:outline-none transition-all shadow-2xs"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400 hover:text-suka-brown text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Download Buttons */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          <button
            type="button"
            onClick={() => exportPettyCashCSV(filteredRequests, `Riwayat_PettyCash_${new Date().toISOString().split('T')[0]}.csv`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-xl border border-emerald-200/80 transition-all shadow-2xs active:scale-95 cursor-pointer"
            title="Unduh data riwayat ke format CSV/Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Download CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportPettyCashPDF(filteredRequests, `Riwayat_PettyCash_${new Date().toISOString().split('T')[0]}.pdf`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs rounded-xl border border-red-200/80 transition-all shadow-2xs active:scale-95 cursor-pointer"
            title="Unduh dokumen laporan ke format PDF"
          >
            <FileText className="w-4 h-4 text-red-600" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* LIST / TABLE CONTENT */}
      {!filteredRequests || filteredRequests.length === 0 ? (
        <EmptyState
          title={activeTab === 'review' ? "Tidak ada pengajuan aktif" : "Tidak ada riwayat"}
          description={activeTab === 'review' ? "Belum ada pengajuan petty cash yang membutuhkan tindakan Leader." : "Belum ada riwayat petty cash."}
        />
      ) : (
        <div className="bg-white rounded-3xl border border-suka-gray-200/90 shadow-sm overflow-hidden">
          
          {/* DESKTOP TABLE VIEW (md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-suka-gray-200 bg-suka-gray-50 text-[11px] text-suka-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5 font-bold w-[160px]">Tanggal & Waktu</th>
                  <th className="py-3.5 px-5 font-bold w-[190px]">Outlet Cabang</th>
                  <th className="py-3.5 px-5 font-bold w-[190px]">Rekening Tujuan</th>
                  <th className="py-3.5 px-5 font-bold w-[130px]">Nominal</th>
                  <th className="py-3.5 px-5 font-bold">Alasan / Keperluan</th>
                  <th className="py-3.5 px-5 font-bold w-[220px]">Status Hirarki</th>
                  <th className="py-3.5 px-5 font-bold text-right w-[150px]">Bukti / Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100 text-xs">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-suka-gray-50/60 transition-colors">
                    
                    {/* Tanggal */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      <div className="font-bold text-suka-brown flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-suka-gray-400" />
                        {formatDateTime(req.created_at)}
                      </div>
                      <div className="text-[10px] text-suka-gray-400 mt-0.5">{relativeTime(req.created_at)}</div>
                    </td>

                    {/* Outlet */}
                    <td className="py-4 px-5 font-extrabold text-suka-brown">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-suka-orange shrink-0" />
                        <span>{req.outlet?.name || '-'}</span>
                      </div>
                    </td>

                    {/* Rekening Tujuan */}
                    <td className="py-4 px-5 text-xs">
                      {req.bank_name ? (
                        <div className="bg-suka-gray-50 p-2 rounded-xl border border-suka-gray-200/80 space-y-0.5">
                          <div className="font-extrabold text-suka-brown flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-suka-orange" />
                            {req.bank_name} - <span className="font-mono text-suka-brown">{req.bank_account_number}</span>
                          </div>
                          <div className="text-[10px] text-suka-gray-500 font-medium">a.n {req.bank_account_name || '-'}</div>
                        </div>
                      ) : (
                        <span className="text-suka-gray-400 italic text-[11px] bg-suka-gray-100 px-2 py-1 rounded-md">Belum diisi</span>
                      )}
                    </td>

                    {/* Nominal */}
                    <td className="py-4 px-5 font-black text-suka-brown text-sm whitespace-nowrap">
                      Rp {req.amount.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                    </td>

                    {/* Alasan */}
                    <td className="py-4 px-5 text-suka-gray-700 max-w-xs truncate font-medium">
                      {req.reason || req.description}
                    </td>

                    {/* Status Hirarki */}
                    <td className="py-4 px-5">
                      <div className="flex flex-col items-start gap-1">
                        {(req.status === 'pending' || req.status === 'forwarded_to_area_manager') && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Menunggu Area Manager</span>
                          </span>
                        )}
                        {req.status === 'forwarded_to_finance' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Menunggu Finance</span>
                          </span>
                        )}
                        {(req.status === 'approved_by_finance' || req.status === 'forwarded_by_finance') && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-suka-orange/10 text-suka-orange border border-suka-orange/20">
                            <CheckCircle2 className="w-3.5 h-3.5 text-suka-orange shrink-0" />
                            <span>Disetujui Finance (Pencairan)</span>
                          </span>
                        )}
                        {req.status === 'forwarded_by_area_manager' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black bg-emerald-600 text-white animate-pulse">
                            <Send className="w-3.5 h-3.5 shrink-0" />
                            <span>Siap Serahkan ke Crew</span>
                          </span>
                        )}
                        {req.status === 'forwarded_by_leader' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Diserahkan ke Crew (Saldo +)</span>
                          </span>
                        )}
                        {req.status === 'completed' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-600 text-white">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Selesai (Crew Terima)</span>
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>Ditolak</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Bukti / Aksi */}
                    <td className="py-4 px-5 text-right whitespace-nowrap space-y-1">
                      {req.status === 'forwarded_by_area_manager' && activeTab === 'review' && (
                        <button
                          onClick={() => handleForward(req)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm cursor-pointer transition-all"
                        >
                          <Send className="w-3.5 h-3.5" /> Serahkan ke Crew
                        </button>
                      )}

                      {req.proof_of_transfer_url && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setSelectedProofUrl(req.proof_of_transfer_url || null)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Bukti Transfer</span>
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD VIEW (md:hidden) */}
          <div className="block md:hidden divide-y divide-suka-gray-100">
            {filteredRequests.map((req) => (
              <div key={req.id} className="p-4 space-y-3 bg-white hover:bg-suka-gray-50/60 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-suka-orange shrink-0" />
                    <span className="font-extrabold text-suka-brown text-sm">{req.outlet?.name || '-'}</span>
                  </div>
                  <div>
                    {req.status === 'forwarded_by_area_manager' ? (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-600 text-white animate-pulse">
                        Siap Serahkan
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-suka-gray-100 text-suka-gray-700 border border-suka-gray-200">
                        {req.status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-base font-black text-suka-brown">Rp {req.amount.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</span>
                  <span className="text-[10px] font-medium text-suka-gray-400">{formatDateTime(req.created_at)}</span>
                </div>

                <p className="text-xs text-suka-gray-700 font-medium bg-suka-gray-50 p-2.5 rounded-xl border border-suka-gray-100">
                  {req.reason || req.description}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-suka-gray-100 text-xs">
                  <div>
                    {req.bank_name ? (
                      <span className="text-[11px] text-suka-gray-600 font-bold">
                        {req.bank_name} ({req.bank_account_number})
                      </span>
                    ) : (
                      <span className="text-[10px] text-suka-gray-400 italic">Belum ada rekening</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {req.proof_of_transfer_url && (
                      <button
                        type="button"
                        onClick={() => setSelectedProofUrl(req.proof_of_transfer_url || null)}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[11px] rounded-lg border border-emerald-200"
                      >
                        📷 Bukti
                      </button>
                    )}

                    {req.status === 'forwarded_by_area_manager' && activeTab === 'review' && (
                      <button
                        onClick={() => handleForward(req)}
                        className="px-3 py-1.5 bg-emerald-600 text-white font-black text-[11px] rounded-xl shadow-xs"
                      >
                        Serahkan ke Crew
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {selectedRequest && (
        <ApprovalModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          request={selectedRequest}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      <CreateTopupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <ProofImageLightbox
        imageUrl={selectedProofUrl}
        onClose={() => setSelectedProofUrl(null)}
      />
    </div>
  )
}
