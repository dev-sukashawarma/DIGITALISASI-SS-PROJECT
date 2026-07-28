'use client'

import React, { useState, useRef } from 'react'
import { Wallet, X, Store, CreditCard, Building2, User, AlertCircle, CheckCircle2, XCircle, Trash2, Camera, MessageSquare } from 'lucide-react'
import type { PettyCashTopup, DisbursementMethod } from '@/lib/types'
import { relativeTime, tanggalWaktu } from '@/lib/format'
import { useCashOverview } from '@/hooks/useCashData'

interface FinanceApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  request: PettyCashTopup
  onApprove: (
    method: DisbursementMethod,
    cashLocationId?: string,
    proofFile?: File | null,
    approvedAmount?: number,
    approvalNote?: string
  ) => Promise<void>
  onReject: () => Promise<void>
}

export function FinanceApprovalModal({ isOpen, onClose, request, onApprove, onReject }: FinanceApprovalModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  
  // Default mandatory method: Transfer Bank
  const [method, setMethod] = useState<DisbursementMethod>('transfer')
  const [cashLocationId, setCashLocationId] = useState<string>('')
  
  // Photo File Upload State
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [proofFileName, setProofFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Custom Amount State
  const [approvedAmount, setApprovedAmount] = useState<number>(request.amount)
  const [approvalNote, setApprovalNote] = useState<string>('')

  // Reset state when request changes
  React.useEffect(() => {
    if (isOpen) {
      setApprovedAmount(request.amount)
      setApprovalNote('')
      setProofFile(null)
      setProofImage(null)
      setProofFileName(null)
    }
  }, [isOpen, request.amount])
  
  const { locations } = useCashOverview()

  const HARDCODED_LOCATIONS = [
    {
      id: '0c116d5f-f147-4eff-9bc2-ce9d549e2869',
      label: 'SUKA PROFIT BERKAH (BCA) - 48523399425',
      kind: 'bank',
      saldo: 10471000
    },
    {
      id: 'a64f9484-70e9-4bf7-b62d-2643835a1874',
      label: 'Kas Setoran (Kas Fisik)',
      kind: 'cash',
      saldo: 10000000
    }
  ]

  const activeLocations = locations && locations.length > 0 ? locations : HARDCODED_LOCATIONS

  // Filter available locations for transfer/tunai
  const filtered = activeLocations.filter(loc => 
    (method === 'transfer' && loc.kind === 'bank') || 
    (method === 'tunai' && loc.kind === 'cash')
  )
  const availableLocations = filtered.length > 0 ? filtered : activeLocations

  React.useEffect(() => {
    if (availableLocations.length > 0 && (!cashLocationId || !availableLocations.some(l => l.id === cashLocationId))) {
      setCashLocationId(availableLocations[0].id)
    }
  }, [availableLocations, method])

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file foto maksimal 5MB')
        return
      }
      setProofFile(file)
      setProofFileName(file.name)
      setProofImage(URL.createObjectURL(file))
    }
  }

  const handleRemovePhoto = () => {
    if (proofImage) {
      URL.revokeObjectURL(proofImage)
    }
    setProofFile(null)
    setProofImage(null)
    setProofFileName(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleAction = async (type: 'approve' | 'reject') => {
    if (type === 'approve') {
      if (approvedAmount !== request.amount && !approvalNote.trim()) {
        alert('Harap isi catatan/keterangan Finance karena nominal yang disetujui berbeda dengan yang diajukan.')
        return
      }
      
      if (cashLocationId) {
        const selectedLoc = availableLocations.find(l => l.id === cashLocationId)
        if (selectedLoc && selectedLoc.saldo < approvedAmount) {
          alert(`Saldo tidak mencukupi! Saldo saat ini: Rp ${selectedLoc.saldo.toLocaleString('id-ID')}, dibutuhkan: Rp ${approvedAmount.toLocaleString('id-ID')}`)
          return
        }
      }
    }

    setIsLoading(true)
    setActionType(type)
    try {
      if (type === 'approve') {
        await onApprove(method, cashLocationId || undefined, proofFile, approvedAmount, approvalNote)
      } else {
        await onReject()
      }
    } catch (err: any) {
      console.error('Error processing petty cash disbursement:', err)
      alert('Gagal memproses pencairan: ' + (err.message || 'Terjadi kesalahan pada koneksi server.'))
    } finally {
      setIsLoading(false)
      setActionType(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true">
        
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shadow-2xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">Pencairan Dana Petty Cash</h2>
              <p className="text-[11px] text-slate-400 font-medium">Verifikasi rekening & sumber dana pencairan</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-6 space-y-4.5 overflow-y-auto flex-1 text-xs">
          
          {/* Summary Box with Editable Amount */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Outlet Pemohon</span>
                <div className="flex items-center gap-1.5 font-extrabold text-slate-900 text-sm">
                  <Store className="w-4 h-4 text-amber-500" />
                  {request.outlet?.name || '-'}
                </div>
                <div className="text-[11px] font-medium text-slate-400" title={tanggalWaktu(request.created_at)}>
                  {relativeTime(request.created_at)} ({tanggalWaktu(request.created_at)})
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nominal Diajukan</span>
                <div className="text-sm font-bold text-slate-400 line-through decoration-slate-300">
                  Rp {request.amount.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/80">
              <label className="block text-[11px] font-extrabold text-slate-800 mb-1.5 uppercase tracking-wider">
                Nominal Disetujui (Acc)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-bold">Rp</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={approvedAmount || ''}
                  onChange={(e) => setApprovedAmount(Number(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-amber-300 focus:border-amber-500 rounded-xl font-black text-lg text-slate-900 focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">
                Ubah nominal ini jika Finance hanya menyetujui sebagian dana.
              </p>
            </div>
            
            {/* Always visible Finance Note Input */}
            <div className="pt-1">
              <label className="block text-[11px] font-extrabold text-slate-800 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                Catatan / Keterangan Finance{' '}
                {approvedAmount !== request.amount ? (
                  <span className="text-red-500 font-bold">* (Wajib diisi)</span>
                ) : (
                  <span className="text-slate-400 font-normal">(Opsional)</span>
                )}
              </label>
              <textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder={
                  approvedAmount !== request.amount
                    ? "Contoh: Hanya disetujui Rp 300.000 karena sisa keperluan ditunda..."
                    : "Tambahkan catatan instruksi pencairan untuk AM, Leader, dan Crew (opsional)..."
                }
                className={`w-full px-3.5 py-2.5 bg-white border rounded-xl font-medium text-xs text-slate-900 focus:outline-none transition-colors ${
                  approvedAmount !== request.amount ? 'border-amber-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20' : 'border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                }`}
                rows={2}
              />
            </div>
          </div>

          {/* Reason Section */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Alasan Pengajuan (Dari Outlet)</span>
            <p className="text-xs font-semibold text-slate-800 leading-relaxed">
              {request.reason || request.description}
            </p>
          </div>

          {/* Target Bank Account Display */}
          <div className="bg-amber-50/50 rounded-2xl p-3.5 border border-amber-200/70 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-900 uppercase tracking-wider">
              <CreditCard className="w-4 h-4 text-amber-600" />
              <span>Rekening Tujuan Transfer (Outlet)</span>
            </div>

            {request.bank_name ? (
              <div className="grid grid-cols-2 gap-2 text-xs bg-white rounded-xl p-3 border border-amber-200/60 shadow-2xs text-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Bank</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-amber-500" /> {request.bank_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">No. Rekening</span>
                  <span className="font-mono font-bold text-slate-900">{request.bank_account_number}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-100 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">a.n</span>
                  <span className="font-bold text-slate-900">{request.bank_account_name || '-'}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-3 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Belum ada data rekening resmi terdaftar untuk outlet ini.</span>
              </div>
            )}
          </div>
          
          {/* Method Choice */}
          <div className="space-y-1.5 pt-0.5">
            <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider block">Metode Pencairan</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label 
                className={`flex flex-col justify-between p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                  method === 'transfer' 
                    ? 'border-amber-500 bg-amber-50/50' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-extrabold text-slate-900">Transfer Bank</span>
                  <input 
                    type="radio" 
                    name="method" 
                    value="transfer"
                    checked={method === 'transfer'}
                    onChange={() => setMethod('transfer')}
                    className="accent-amber-500 w-4 h-4 cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-medium leading-tight">Transfer ke rekening outlet resmi</span>
              </label>

              <label 
                className={`flex flex-col justify-between p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                  method === 'tunai' 
                    ? 'border-amber-500 bg-amber-50/50' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-extrabold text-amber-900">Beri Tunai</span>
                  <input 
                    type="radio" 
                    name="method" 
                    value="tunai"
                    checked={method === 'tunai'}
                    onChange={() => setMethod('tunai')}
                    className="accent-amber-600 w-4 h-4 cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-amber-800 font-medium leading-tight">Uang kas fisik dari Kas Pusat (Darurat)</span>
              </label>
            </div>
          </div>

          {/* Cash Location Selector */}
          <div className="space-y-1">
            <label className="block text-[11px] font-extrabold text-slate-800">
              Sumber Akun Kas / Bank Pusat ({method === 'transfer' ? 'Rekening Bank' : 'Kas Fisik'})
            </label>
            <select 
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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

          {/* Photo File Upload Input (FOR TRANSFER BUKTI) */}
          {method === 'transfer' && (
            <div className="space-y-1">
              <label className="block text-[11px] font-extrabold text-slate-800">
                Upload Foto Bukti Transfer (Opsional)
              </label>
              
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="proof-photo-upload"
              />

              {!proofImage ? (
                <label 
                  htmlFor="proof-photo-upload"
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/20 rounded-2xl cursor-pointer transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-amber-500 group-hover:border-amber-300 shadow-2xs mb-1.5 transition-colors">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-amber-600 transition-colors">
                    Klik untuk Pilih Foto Bukti Transfer
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Format: JPG, PNG, WEBP (Maksimal 5MB)</span>
                </label>
              ) : (
                <div className="relative bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-300 shrink-0 bg-white relative">
                    <img src={proofImage} alt="Preview Bukti" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-800 block truncate">{proofFileName || 'Bukti_Transfer.jpg'}</span>
                    <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Foto siap dilampirkan
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors shrink-0 cursor-pointer"
                    title="Hapus Foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isLoading}
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button 
            type="button"
            onClick={() => handleAction('reject')}
            disabled={isLoading && actionType !== 'reject'}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 rounded-xl font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            {isLoading && actionType === 'reject' ? 'Memproses...' : 'Tolak'}
          </button>
          <button 
            type="button"
            onClick={() => handleAction('approve')}
            disabled={isLoading && actionType !== 'approve'}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isLoading && actionType === 'approve' ? 'Memproses...' : 'Acc & Cairkan'}
          </button>
        </div>
      </div>
    </div>
  )
}
