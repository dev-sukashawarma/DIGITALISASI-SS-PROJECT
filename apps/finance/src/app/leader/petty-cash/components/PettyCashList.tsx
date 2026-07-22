'use client'

import React, { useState } from 'react'
import { Card, Badge, Button, Spinner, EmptyState } from '@suka/design-system'
import { ApprovalModal } from '@/components/petty-cash/ApprovalModal'
import { CreateTopupModal } from './CreateTopupModal'
import { usePettyCashRequests, useProcessPettyCashLeader, useForwardPettyCashLeader } from '@/hooks/usePettyCash'
import { tanggalWaktu, relativeTime } from '@/lib/format'
import type { PettyCashTopup } from '@/lib/types'

export function PettyCashList({ initialRequests }: { initialRequests?: PettyCashTopup[] }) {
  const { data: allRequests, isLoading } = usePettyCashRequests(undefined, initialRequests)
  const processTopup = useProcessPettyCashLeader()
  const forwardTopup = useForwardPettyCashLeader()
  
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')
  const [selectedRequest, setSelectedRequest] = useState<PettyCashTopup | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

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
  
  const requests = activeTab === 'review' ? reviewRequests : historyRequests

  const handleOpenModal = (req: PettyCashTopup) => {
    setSelectedRequest(req)
    setIsModalOpen(true)
  }

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
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex space-x-2 border-b border-suka-gray-200">
          <button
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'review' ? 'border-suka-brown text-suka-brown' : 'border-transparent text-suka-gray-500 hover:text-suka-gray-700'}`}
            onClick={() => setActiveTab('review')}
          >
            Aktif / Butuh Serah Terima ({reviewRequests.length})
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'history' ? 'border-suka-brown text-suka-brown' : 'border-transparent text-suka-gray-500 hover:text-suka-gray-700'}`}
            onClick={() => setActiveTab('history')}
          >
            Riwayat ({historyRequests.length})
          </button>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
          + Buat Pengajuan Top Up
        </Button>
      </div>

      {!requests || requests.length === 0 ? (
        <EmptyState
          title={activeTab === 'review' ? "Tidak ada pengajuan aktif" : "Tidak ada riwayat"}
          description={activeTab === 'review' ? "Belum ada pengajuan petty cash yang butuh tindakan Leader." : "Belum ada riwayat petty cash."}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-suka-gray-200 bg-suka-gray-50">
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Tanggal</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Outlet</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Rekening Tujuan</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Nominal</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Alasan</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase">Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-suka-gray-500 uppercase text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-suka-gray-100 last:border-0 hover:bg-suka-gray-50 transition-colors">
                  <td className="py-3 px-4 text-sm whitespace-nowrap" title={tanggalWaktu(req.created_at)}>
                    <div className="font-bold text-suka-brown">{relativeTime(req.created_at)}</div>
                    <div className="text-[11px] text-suka-gray-500 font-normal">{tanggalWaktu(req.created_at)}</div>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-suka-brown">{req.outlet?.name || '-'}</td>
                  <td className="py-3 px-4 text-xs text-suka-gray-600">
                    {req.bank_name ? (
                      <div>
                        <div className="font-semibold text-suka-brown">{req.bank_name} - {req.bank_account_number}</div>
                        <div className="text-suka-gray-500">a.n {req.bank_account_name || '-'}</div>
                      </div>
                    ) : (
                      <span className="text-suka-gray-400 font-mono">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-suka-brown whitespace-nowrap">
                    Rp {req.amount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-sm text-suka-gray-600">{req.reason || req.description}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {(req.status === 'pending' || req.status === 'forwarded_to_area_manager') && (
                      <Badge variant="warning">Menunggu Area Manager</Badge>
                    )}
                    {req.status === 'forwarded_to_finance' && (
                      <Badge variant="info">Menunggu Finance</Badge>
                    )}
                    {req.status === 'approved_by_finance' && (
                      <Badge variant="info">Disetujui Finance (Pencairan)</Badge>
                    )}
                    {req.status === 'forwarded_by_finance' && (
                      <Badge variant="info">Ke Area Manager</Badge>
                    )}
                    {req.status === 'forwarded_by_area_manager' && (
                      <button
                        onClick={() => handleForward(req)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-all"
                      >
                        Serahkan ke Crew
                      </button>
                    )}
                    {req.status === 'forwarded_by_leader' && (
                      <Badge variant="success">Diserahkan ke Crew (Saldo +)</Badge>
                    )}
                    {req.status === 'completed' && (
                      <Badge variant="success">Selesai (Crew Konfirmasi)</Badge>
                    )}
                    {req.status === 'rejected' && (
                      <Badge variant="error">Ditolak</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {req.status === 'pending' && activeTab === 'review' && (
                      <Button variant="secondary" size="sm" onClick={() => handleOpenModal(req)}>
                        Review
                      </Button>
                    )}
                    {req.status === 'forwarded_by_area_manager' && activeTab === 'review' && (
                      <Button variant="primary" size="sm" onClick={() => handleForward(req)}>
                        Serahkan ke Crew
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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
    </div>
  )
}
