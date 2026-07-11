'use client'

import React, { useState } from 'react'
import { Card, Badge, Button, Spinner, EmptyState } from '@suka/design-system'
import { ApprovalModal } from '@/components/petty-cash/ApprovalModal'
import { usePettyCashRequests, useProcessPettyCashKorlap } from '@/hooks/usePettyCash'
import { tanggal } from '@/lib/format'
import type { PettyCashTopup } from '@/lib/types'

export function PettyCashList() {
  const { data: requests, isLoading } = usePettyCashRequests('forwarded_to_korlap')
  const processTopup = useProcessPettyCashKorlap()
  
  const [selectedRequest, setSelectedRequest] = useState<PettyCashTopup | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Spinner /></div>
  }

  if (!requests || requests.length === 0) {
    return (
      <EmptyState
        title="Tidak ada pengajuan"
        description="Belum ada pengajuan petty cash yang butuh review."
      />
    )
  }

  return (
    <>
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
                  {req.status === 'pending' && <Badge variant="warning">Menunggu Leader</Badge>}
                  {req.status === 'forwarded_to_korlap' && <Badge variant="info">Menunggu Korlap</Badge>}
                  {req.status === 'forwarded_to_finance' && <Badge variant="info">Menunggu Finance</Badge>}
                  {req.status === 'approved' && <Badge variant="success">Disetujui</Badge>}
                  {req.status === 'rejected' && <Badge variant="error">Ditolak</Badge>}
                </td>
                <td className="py-3 px-4 text-right">
                  {req.status === 'forwarded_to_korlap' && (
                    <Button variant="secondary" size="sm" onClick={() => handleOpenModal(req)}>
                      Review
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selectedRequest && (
        <ApprovalModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          request={selectedRequest}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </>
  )
}
