'use client'

import React, { useState } from 'react'
import { Card, Badge, Button, Spinner, EmptyState } from '@suka/design-system'
import { FinanceApprovalModal } from './FinanceApprovalModal'
import { usePettyCashRequests, useProcessPettyCashFinance } from '@/hooks/usePettyCash'
import { tanggal } from '@/lib/format'
import type { PettyCashTopup, DisbursementMethod } from '@/lib/types'

export function FinancePettyCashList() {
  const { data: allRequests, isLoading } = usePettyCashRequests()
  const processTopup = useProcessPettyCashFinance()
  
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')
  const [selectedRequest, setSelectedRequest] = useState<PettyCashTopup | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const reviewRequests = allRequests?.filter(r => r.status === 'forwarded_to_finance') || []
  const historyRequests = allRequests?.filter(r => r.status !== 'forwarded_to_finance' && r.status !== 'pending' && r.status !== 'forwarded_to_korlap') || []
  
  const requests = activeTab === 'review' ? reviewRequests : historyRequests

  const handleOpenModal = (req: PettyCashTopup) => {
    setSelectedRequest(req)
    setIsModalOpen(true)
  }

  const handleApprove = async (method: DisbursementMethod, cashLocationId?: string) => {
    if (!selectedRequest) return
    await processTopup.mutateAsync({ 
      id: selectedRequest.id, 
      action: 'approve',
      method,
      cashLocationId
    })
    setIsModalOpen(false)
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    await processTopup.mutateAsync({ id: selectedRequest.id, action: 'reject' })
    setIsModalOpen(false)
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
          Butuh Review ({reviewRequests.length})
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
          description={activeTab === 'review' ? "Belum ada pengajuan petty cash yang diteruskan oleh Leader." : "Belum ada riwayat petty cash."}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-suka-gray-200">
                <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Tanggal</th>
                <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Karyawan</th>
                <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Outlet</th>
                <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Nominal</th>
                <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Alasan</th>
                <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Status</th>
                <th className="py-3 px-4 text-sm font-medium text-suka-gray-500 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-suka-gray-100 last:border-0 hover:bg-suka-gray-50 transition-colors">
                  <td className="py-3 px-4 text-sm text-suka-brown">{tanggal(req.created_at)}</td>
                  <td className="py-3 px-4 text-sm font-medium text-suka-brown">{req.outlet_staff?.name || '-'}</td>
                  <td className="py-3 px-4 text-sm font-medium text-suka-brown">{req.outlet?.name || '-'}</td>
                  <td className="py-3 px-4 text-sm text-suka-brown">
                    Rp {req.amount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-sm text-suka-gray-500">{req.reason}</td>
                  <td className="py-3 px-4">
                    {req.status === 'forwarded_to_finance' && <Badge variant="info">Menunggu Finance</Badge>}
                    {req.status === 'approved_by_finance' && <Badge variant="info">Disetujui Finance (Serahkan)</Badge>}
                    {req.status === 'forwarded_by_korlap' && <Badge variant="success">Diserahkan ke Leader</Badge>}
                    {req.status === 'forwarded_by_leader' && <Badge variant="success">Diserahkan ke Crew</Badge>}
                    {req.status === 'completed' && <Badge variant="success">Selesai</Badge>}
                    {req.status === 'rejected' && <Badge variant="error">Ditolak</Badge>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {req.status === 'forwarded_to_finance' && activeTab === 'review' && (
                      <Button variant="secondary" size="sm" onClick={() => handleOpenModal(req)}>
                        Proses
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
