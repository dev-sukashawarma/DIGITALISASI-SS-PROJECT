'use client'

import React, { useState } from 'react'
import { Button } from '@suka/design-system'
import type { PettyCashTopup, DisbursementMethod } from '@/lib/types'
import { useCashOverview } from '@/hooks/useCashData'

interface FinanceApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  request: PettyCashTopup
  onApprove: (method: DisbursementMethod, cashLocationId?: string, proofOfTransferUrl?: string) => Promise<void>
  onReject: () => Promise<void>
}

export function FinanceApprovalModal({ isOpen, onClose, request, onApprove, onReject }: FinanceApprovalModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  
  // Default mandatory method: Transfer Bank
  const [method, setMethod] = useState<DisbursementMethod>('transfer')
  const [cashLocationId, setCashLocationId] = useState<string>('')
  const [proofUrl, setProofUrl] = useState<string>('')
  
  const { locations } = useCashOverview()

  // Filter available locations for transfer/tunai
  const availableLocations = locations.filter(loc => 
    (method === 'transfer' && loc.kind === 'bank') || 
    (method === 'tunai' && loc.kind === 'cash')
  )

  if (!isOpen) return null

  const handleAction = async (type: 'approve' | 'reject') => {
    if (type === 'approve') {
      if (cashLocationId) {
        const selectedLoc = availableLocations.find(l => l.id === cashLocationId)
        if (selectedLoc && selectedLoc.saldo < request.amount) {
          alert(`Saldo tidak mencukupi! Saldo saat ini: Rp ${selectedLoc.saldo.toLocaleString('id-ID')}, dibutuhkan: Rp ${request.amount.toLocaleString('id-ID')}`)
          return
        }
      }
    }

    setIsLoading(true)
    setActionType(type)
    try {
      if (type === 'approve') {
        await onApprove(method, cashLocationId || undefined, proofUrl || undefined)
      } else {
        await onReject()
      }
    } finally {
      setIsLoading(false)
      setActionType(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" role="dialog" aria-modal="true">
        <div className="p-6">
          <div className="flex justify-between items-center border-b border-suka-gray-100 pb-3 mb-4">
            <h2 className="text-xl font-bold text-suka-brown">Pencairan Dana Petty Cash</h2>
            <button onClick={onClose} className="text-suka-gray-400 hover:text-suka-gray-600 font-bold">✕</button>
          </div>
          
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-3 bg-suka-gray-50 p-3 rounded-lg border border-suka-gray-200">
              <div>
                <p className="text-[10px] text-suka-gray-500 font-bold uppercase">Outlet</p>
                <p className="text-sm font-semibold text-suka-brown">{request.outlet?.name || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] text-suka-gray-500 font-bold uppercase">Nominal</p>
                <p className="text-sm font-bold text-emerald-600">Rp {request.amount.toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-suka-gray-500 font-medium">Alasan Pengajuan</p>
              <p className="text-xs text-suka-brown bg-amber-50/60 p-2.5 rounded-md mt-1 border border-amber-100">{request.reason || request.description}</p>
            </div>

            {/* Target Bank Account Display */}
            <div className="bg-blue-50/80 p-3 rounded-lg border border-blue-200 space-y-1">
              <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Rekening Tujuan Transfer (Outlet)</p>
              {request.bank_name ? (
                <div className="text-xs text-blue-900 font-medium space-y-0.5">
                  <div>Bank: <span className="font-bold">{request.bank_name}</span></div>
                  <div>No. Rekening: <span className="font-bold font-mono">{request.bank_account_number}</span></div>
                  <div>Atas Nama: <span className="font-bold">{request.bank_account_name || '-'}</span></div>
                </div>
              ) : (
                <p className="text-xs text-blue-700 italic">Belum ada data rekening terdaftar untuk pengajuan ini.</p>
              )}
            </div>
            
            <div className="pt-2 border-t border-suka-gray-100">
              <p className="text-xs font-bold text-suka-brown uppercase tracking-wider mb-2">Metode Pencairan</p>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-2 rounded-lg border border-suka-gray-200 cursor-pointer hover:bg-suka-gray-50">
                  <input 
                    type="radio" 
                    name="method" 
                    value="transfer"
                    checked={method === 'transfer'}
                    onChange={() => setMethod('transfer')}
                    className="mt-0.5 accent-suka-brown"
                  />
                  <div>
                    <span className="text-xs font-bold text-suka-brown block">Transfer Bank (Wajib / Utama)</span>
                    <span className="text-[10px] text-suka-gray-500">Transfer ke rekening resmi outlet sesuai pengajuan</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2 rounded-lg border border-suka-gray-200 cursor-pointer hover:bg-suka-gray-50">
                  <input 
                    type="radio" 
                    name="method" 
                    value="tunai"
                    checked={method === 'tunai'}
                    onChange={() => setMethod('tunai')}
                    className="mt-0.5 accent-suka-brown"
                  />
                  <div>
                    <span className="text-xs font-bold text-amber-700 block">Beri Tunai (Urgent / Darurat)</span>
                    <span className="text-[10px] text-amber-600">Gunakan uang kas fisik dari Kas Pusat jika kondisi sangat mendesak</span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-suka-brown mb-1">
                Pilih Akun Kas/Bank Pusat ({method === 'transfer' ? 'Rekening Bank' : 'Kas Fisik'})
              </label>
              <select 
                className="w-full px-3 py-2 border border-suka-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-suka-brown"
                value={cashLocationId}
                onChange={(e) => setCashLocationId(e.target.value)}
              >
                <option value="">-- Pilih Sumber Dana --</option>
                {availableLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.label} (Saldo: Rp {loc.saldo.toLocaleString('id-ID')})
                  </option>
                ))}
              </select>
            </div>

            {method === 'transfer' && (
              <div>
                <label className="block text-xs font-medium text-suka-brown mb-1">
                  Bukti Transfer / No. Referensi (Opsional)
                </label>
                <input 
                  type="text"
                  placeholder="URL bukti transfer atau No. Referensi Bank"
                  className="w-full px-3 py-2 border border-suka-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-suka-brown"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-suka-gray-200">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={onClose} 
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button 
              variant="danger" 
              size="sm"
              onClick={() => handleAction('reject')}
              disabled={isLoading && actionType !== 'reject'}
            >
              {isLoading && actionType === 'reject' ? 'Memproses...' : 'Tolak'}
            </Button>
            <Button 
              variant="primary" 
              size="sm"
              onClick={() => handleAction('approve')}
              disabled={isLoading && actionType !== 'approve'}
            >
              {isLoading && actionType === 'approve' ? 'Memproses...' : 'Acc & Cairkan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
