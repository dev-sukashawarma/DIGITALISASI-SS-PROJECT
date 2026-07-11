'use client'

import React, { useState } from 'react'
import { Card, Badge, Button, StatusPill } from '@suka/design-system'
import { ApprovalModal } from './ApprovalModal'

// Dummy data for initial display
const MOCK_REQUESTS = [
  { id: '1', date: '2026-07-11 08:30', crewName: 'Budi (Kasir)', amount: 50000, reason: 'Beli kantong plastik putih', status: 'pending' },
  { id: '2', date: '2026-07-11 09:15', crewName: 'Siti (Kitchen)', amount: 150000, reason: 'Isi ulang gas Elpiji 12kg', status: 'pending' },
  { id: '3', date: '2026-07-10 14:20', crewName: 'Andi (Kasir)', amount: 20000, reason: 'Beli lakban', status: 'approved' },
]

export function PettyCashList() {
  const [requests, setRequests] = useState(MOCK_REQUESTS)
  const [selectedRequest, setSelectedRequest] = useState<typeof MOCK_REQUESTS[0] | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleOpenModal = (req: typeof MOCK_REQUESTS[0]) => {
    setSelectedRequest(req)
    setIsModalOpen(true)
  }

  const handleApprove = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRequests(prev => prev.map(r => r.id === selectedRequest?.id ? { ...r, status: 'approved' } : r))
    setIsModalOpen(false)
  }

  const handleReject = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRequests(prev => prev.map(r => r.id === selectedRequest?.id ? { ...r, status: 'rejected' } : r))
    setIsModalOpen(false)
  }

  return (
    <>
      <Card className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-suka-gray-200">
              <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Tanggal</th>
              <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Karyawan</th>
              <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Nominal</th>
              <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Alasan</th>
              <th className="py-3 px-4 text-sm font-medium text-suka-gray-500">Status</th>
              <th className="py-3 px-4 text-sm font-medium text-suka-gray-500 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id} className="border-b border-suka-gray-100 last:border-0 hover:bg-suka-gray-50 transition-colors">
                <td className="py-3 px-4 text-sm text-suka-brown">{req.date}</td>
                <td className="py-3 px-4 text-sm font-medium text-suka-brown">{req.crewName}</td>
                <td className="py-3 px-4 text-sm text-suka-brown">
                  Rp {req.amount.toLocaleString('id-ID')}
                </td>
                <td className="py-3 px-4 text-sm text-suka-gray-500">{req.reason}</td>
                <td className="py-3 px-4">
                  {req.status === 'pending' && <Badge variant="warning">Menunggu</Badge>}
                  {req.status === 'approved' && <Badge variant="success">Disetujui</Badge>}
                  {req.status === 'rejected' && <Badge variant="error">Ditolak</Badge>}
                </td>
                <td className="py-3 px-4 text-right">
                  {req.status === 'pending' && (
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
