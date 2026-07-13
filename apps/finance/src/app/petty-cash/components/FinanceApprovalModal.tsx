'use client'

import React, { useState } from 'react'
import { Button } from '@suka/design-system'
import type { PettyCashTopup, DisbursementMethod } from '@/lib/types'
import { useCashOverview } from '@/hooks/useCashData'

interface FinanceApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  request: PettyCashTopup
  onApprove: (method: DisbursementMethod, cashLocationId?: string) => Promise<void>
  onReject: () => Promise<void>
}

export function FinanceApprovalModal({ isOpen, onClose, request, onApprove, onReject }: FinanceApprovalModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  
  const [method, setMethod] = useState<DisbursementMethod>('potong_setoran')
  const [cashLocationId, setCashLocationId] = useState<string>('')
  
  const { locations } = useCashOverview()

  // Filter available locations for transfer/tunai
  const availableLocations = locations.filter(loc => 
    (method === 'transfer' && loc.kind === 'bank') || 
    (method === 'tunai' && loc.kind === 'cash')
  )

  if (!isOpen) return null

  const handleAction = async (type: 'approve' | 'reject') => {
    if (type === 'approve' && method !== 'potong_setoran') {
      if (!cashLocationId) {
        alert('Pilih sumber dana kas/bank terlebih dahulu')
        return
      }

      const selectedLoc = availableLocations.find(l => l.id === cashLocationId)
      if (selectedLoc && selectedLoc.saldo < request.amount) {
        alert(`Saldo tidak mencukupi! Saldo saat ini: Rp ${selectedLoc.saldo.toLocaleString('id-ID')}, dibutuhkan: Rp ${request.amount.toLocaleString('id-ID')}`)
        return
      }
    }

    setIsLoading(true)
    setActionType(type)
    try {
      if (type === 'approve') await onApprove(method, method !== 'potong_setoran' ? cashLocationId : undefined)
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
          <h2 className="text-xl font-bold text-suka-brown mb-4">Pencairan Dana</h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <p className="text-xs text-suka-gray-500 font-medium">Pemohon</p>
              <p className="text-sm font-medium text-suka-brown">{request.outlet_staff?.name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-suka-gray-500 font-medium">Nominal</p>
              <p className="text-lg font-bold text-suka-brown">Rp {request.amount.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-xs text-suka-gray-500 font-medium">Alasan Pengajuan</p>
              <p className="text-sm text-suka-brown bg-suka-cream p-3 rounded-md mt-1">{request.reason}</p>
            </div>
            
            <div className="pt-4 border-t border-suka-gray-100">
              <p className="text-sm font-semibold text-suka-brown mb-3">Metode Pencairan</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-suka-brown cursor-pointer">
                  <input 
                    type="radio" 
                    name="method" 
                    value="potong_setoran"
                    checked={method === 'potong_setoran'}
                    onChange={() => setMethod('potong_setoran')}
                    className="accent-suka-orange"
                  />
                  <span>Potong Uang Setoran Outlet (Gunakan uang tunai yang ada di laci kasir)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-suka-brown cursor-pointer">
                  <input 
                    type="radio" 
                    name="method" 
                    value="transfer"
                    checked={method === 'transfer'}
                    onChange={() => setMethod('transfer')}
                    className="accent-suka-orange"
                  />
                  <span>Transfer ke Rekening Outlet</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-suka-brown cursor-pointer">
                  <input 
                    type="radio" 
                    name="method" 
                    value="tunai"
                    checked={method === 'tunai'}
                    onChange={() => setMethod('tunai')}
                    className="accent-suka-orange"
                  />
                  <span>Beri Uang Tunai (Dari Kas Pusat)</span>
                </label>
              </div>
            </div>

            {method !== 'potong_setoran' && (
              <div className="animate-in slide-in-from-top-2">
                <label className="block text-sm font-medium text-suka-brown mb-1">
                  Pilih Sumber Dana ({method === 'transfer' ? 'Bank' : 'Kas'})
                </label>
                <select 
                  className="w-full px-3 py-2 border border-suka-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-suka-orange/20"
                  value={cashLocationId}
                  onChange={(e) => setCashLocationId(e.target.value)}
                >
                  <option value="">-- Pilih --</option>
                  {availableLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.label} (Saldo: Rp {loc.saldo.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
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
              {isLoading && actionType === 'approve' ? 'Memproses...' : 'Setujui & Cairkan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
