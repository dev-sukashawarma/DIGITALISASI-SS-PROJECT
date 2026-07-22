'use client'

import React, { useState } from 'react'
import { Wallet, X, Store, CreditCard, Building2, User, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 leading-tight">Pencairan Dana Petty Cash</h2>
              <p className="text-xs text-slate-500 font-medium">Verifikasi rekening & sumber dana pencairan</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Summary Box */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Outlet Pemohon</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
                <Store className="w-4 h-4 text-slate-500" />
                {request.outlet?.name || '-'}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Nominal Disetujui</span>
              <div className="text-xl font-black text-indigo-600">
                Rp {request.amount.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Reason Section */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Alasan Pengajuan</span>
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              {request.reason || request.description}
            </p>
          </div>

          {/* Target Bank Account Display */}
          <div className="bg-indigo-50/80 rounded-2xl p-4 border border-indigo-200 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 uppercase tracking-wider">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <span>Rekening Tujuan Transfer (Outlet)</span>
            </div>

            {request.bank_name ? (
              <div className="grid grid-cols-2 gap-2 text-xs bg-white rounded-xl p-3 border border-indigo-100 shadow-sm text-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Bank</span>
                  <span className="font-bold text-indigo-900 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" /> {request.bank_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">No. Rekening</span>
                  <span className="font-mono font-bold text-slate-900">{request.bank_account_number}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-100 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">a.n</span>
                  <span className="font-bold text-slate-800">{request.bank_account_name || '-'}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-3 border border-indigo-100 text-xs text-amber-700 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Belum ada data rekening resmi terdaftar untuk outlet ini.</span>
              </div>
            )}
          </div>
          
          {/* Method Choice */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Metode Pencairan</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label 
                className={`flex flex-col justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  method === 'transfer' 
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">Transfer Bank</span>
                  <input 
                    type="radio" 
                    name="method" 
                    value="transfer"
                    checked={method === 'transfer'}
                    onChange={() => setMethod('transfer')}
                    className="accent-indigo-600 w-4 h-4"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium leading-tight">Transfer ke rekening outlet resmi</span>
              </label>

              <label 
                className={`flex flex-col justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  method === 'tunai' 
                    ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-amber-900">Beri Tunai</span>
                  <input 
                    type="radio" 
                    name="method" 
                    value="tunai"
                    checked={method === 'tunai'}
                    onChange={() => setMethod('tunai')}
                    className="accent-amber-600 w-4 h-4"
                  />
                </div>
                <span className="text-[11px] text-amber-700 font-medium leading-tight">Uang kas fisik dari Kas Pusat (Darurat)</span>
              </label>
            </div>
          </div>

          {/* Cash Location Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Sumber Akun Kas / Bank Pusat ({method === 'transfer' ? 'Rekening Bank' : 'Kas Fisik'})
            </label>
            <select 
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={cashLocationId}
              onChange={(e) => setCashLocationId(e.target.value)}
            >
              <option value="">-- Pilih Sumber Dana Kas/Bank --</option>
              {availableLocations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.label} (Saldo: Rp {loc.saldo.toLocaleString('id-ID')})
                </option>
              ))}
            </select>
          </div>

          {/* Proof Input */}
          {method === 'transfer' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Bukti Transfer / No. Referensi (Opsional)
              </label>
              <input 
                type="text"
                placeholder="Nomor Referensi Bank atau URL Bukti"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isLoading}
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button 
            type="button"
            onClick={() => handleAction('reject')}
            disabled={isLoading && actionType !== 'reject'}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            {isLoading && actionType === 'reject' ? 'Memproses...' : 'Tolak'}
          </button>
          <button 
            type="button"
            onClick={() => handleAction('approve')}
            disabled={isLoading && actionType !== 'approve'}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isLoading && actionType === 'approve' ? 'Memproses...' : 'Acc & Cairkan'}
          </button>
        </div>
      </div>
    </div>
  )
}
