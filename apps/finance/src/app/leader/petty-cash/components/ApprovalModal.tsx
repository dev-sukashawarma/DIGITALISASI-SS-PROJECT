'use client'

import React, { useState } from 'react'
import { Button } from '@suka/design-system'

interface RequestData {
  id: string
  crewName: string
  amount: number
  reason: string
  date: string
}

interface ApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  request: RequestData
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
}

export function ApprovalModal({ isOpen, onClose, request, onApprove, onReject }: ApprovalModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)

  if (!isOpen) return null

  const handleAction = async (type: 'approve' | 'reject') => {
    setIsLoading(true)
    setActionType(type)
    try {
      if (type === 'approve') await onApprove()
      else await onReject()
    } finally {
      setIsLoading(false)
      setActionType(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" role="dialog" aria-modal="true">
        <div className="p-6">
          <h2 className="text-xl font-bold text-suka-brown mb-4">Review Pengajuan</h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <p className="text-xs text-suka-gray-500 font-medium">Pemohon</p>
              <p className="text-sm font-medium text-suka-brown">{request.crewName}</p>
            </div>
            <div>
              <p className="text-xs text-suka-gray-500 font-medium">Nominal</p>
              <p className="text-lg font-bold text-suka-brown">Rp {request.amount.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-xs text-suka-gray-500 font-medium">Alasan Pengajuan</p>
              <p className="text-sm text-suka-brown bg-suka-cream p-3 rounded-md mt-1">{request.reason}</p>
            </div>
            
            <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-md flex gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Jika disetujui, request akan otomatis diteruskan ke Admin Finance.</span>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button 
              variant="danger" 
              onClick={() => handleAction('reject')}
              disabled={isLoading && actionType !== 'reject'}
            >
              {isLoading && actionType === 'reject' ? 'Memproses...' : 'Tolak'}
            </Button>
            <Button 
              variant="primary" 
              onClick={() => handleAction('approve')}
              disabled={isLoading && actionType !== 'approve'}
            >
              {isLoading && actionType === 'approve' ? 'Memproses...' : 'Setujui & Teruskan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
