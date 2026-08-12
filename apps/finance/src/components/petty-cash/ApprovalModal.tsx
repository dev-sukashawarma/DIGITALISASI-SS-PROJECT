'use client'

import React, { useState } from 'react'
import { Wallet, X, CheckCircle2, XCircle, Info } from 'lucide-react'
import type { PettyCashTopup } from '@/lib/types'

interface ApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  request: PettyCashTopup
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden" role="dialog" aria-modal="true">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Review Pengajuan</h2>
            </div>
            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3.5">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pemohon</span>
                <span className="text-xs font-bold text-slate-800">{request.outlet_staff?.name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Nominal</span>
                <span className="text-lg font-black text-indigo-600">Rp {request.amount.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Alasan Pengajuan</span>
              <p className="text-xs font-semibold text-slate-800 leading-snug">{request.reason || request.description}</p>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs p-3.5 rounded-2xl flex items-start gap-2.5 font-medium">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>Jika disetujui, pengajuan akan diteruskan ke Tim Finance untuk proses verifikasi & pencairan.</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
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
              {isLoading && actionType === 'approve' ? 'Memproses...' : 'Setujui & Teruskan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
