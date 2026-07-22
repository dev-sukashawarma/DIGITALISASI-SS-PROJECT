'use client'

import React, { useState } from 'react'
import { Card, Badge, Button, Spinner, EmptyState } from '@suka/design-system'
import { FinanceApprovalModal } from './FinanceApprovalModal'
import { usePettyCashRequests, useProcessPettyCashFinance, useForwardPettyCashFinance } from '@/hooks/usePettyCash'
import { tanggalWaktu } from '@/lib/format'
import type { PettyCashTopup, DisbursementMethod } from '@/lib/types'

export function FinancePettyCashList({ initialRequests }: { initialRequests?: PettyCashTopup[] }) {
  const { data: allRequests, isLoading } = usePettyCashRequests(undefined, initialRequests)
  const processTopup = useProcessPettyCashFinance()
  const forwardTopup = useForwardPettyCashFinance()
  
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')
  const [selectedRequest, setSelectedRequest] = useState<PettyCashTopup | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const reviewRequests = allRequests?.filter(r => 
    r.status === 'forwarded_to_finance' || 
    r.status === 'approved_by_finance'
  ) || []

  const historyRequests = allRequests?.filter(r => 
    r.status !== 'forwarded_to_finance' && 
    r.status !== 'approved_by_finance'
  ) || []
  
  const requests = activeTab === 'review' ? reviewRequests : historyRequests

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
    return <div className="p-8 flex justify-center"><Spinner /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex space-x-2 border-b border-suka-gray-200">
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'review' ? 'border-suka-brown text-suka-brown' : 'border-transparent text-suka-gray-500 hover:text-suka-gray-700'}`}
          onClick={() => setActiveTab('review')}
        >
          Butuh Review & Pencairan ({reviewRequests.length})
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'history' ? 'border-suka-brown text-suka-brown' : 'border-transparent text-suka-gray-500 hover:text-suka-gray-700'}`}
          onClick={() => setActiveTab('history')}
        >
          Riwayat ({historyRequests.length})
        </button>
      </div>

      {!requests || requests.length === 0 ? (
        <EmptyState
          title={activeTab === 'review' ? "Tidak ada pengajuan" : "Tidak ada riwayat"}
          description={activeTab === 'review' ? "Belum ada pengajuan petty cash yang diteruskan oleh Area Manager." : "Belum ada riwayat petty cash."}
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
                  <td className="py-3 px-4 text-sm text-suka-brown whitespace-nowrap">{tanggalWaktu(req.created_at)}</td>
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
                    {req.status === 'forwarded_to_finance' && <Badge variant="warning">Menunggu Acc Finance</Badge>}
                    {req.status === 'approved_by_finance' && <Badge variant="info">Dicairkan (Serahkan ke AM)</Badge>}
                    {req.status === 'forwarded_by_finance' && <Badge variant="info">Diserahkan ke Area Manager</Badge>}
                    {req.status === 'forwarded_by_area_manager' && <Badge variant="success">Diserahkan ke Leader</Badge>}
                    {req.status === 'forwarded_by_leader' && <Badge variant="success">Diserahkan ke Crew</Badge>}
                    {req.status === 'completed' && <Badge variant="success">Selesai</Badge>}
                    {req.status === 'rejected' && <Badge variant="error">Ditolak</Badge>}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {req.status === 'forwarded_to_finance' && activeTab === 'review' && (
                      <Button variant="primary" size="sm" onClick={() => handleOpenModal(req)}>
                        Proses / Acc
                      </Button>
                    )}
                    {req.status === 'approved_by_finance' && activeTab === 'review' && (
                      <Button variant="secondary" size="sm" onClick={() => handleForwardToAreaManager(req)}>
                        Serahkan ke Area Manager
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
