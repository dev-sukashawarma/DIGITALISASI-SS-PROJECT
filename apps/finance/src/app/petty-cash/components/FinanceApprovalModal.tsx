'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Wallet, X, Store, CreditCard, Building2, User, AlertCircle, CheckCircle2, XCircle, Trash2, Camera, MessageSquare, ChevronDown, Check } from 'lucide-react'
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Photo File Upload State
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [proofFileName, setProofFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Custom Amount State
  const [approvedAmount, setApprovedAmount] = useState<number>(request.amount)
  const [approvalNote, setApprovalNote] = useState<string>('')

  // Reset state when request changes
  useEffect(() => {
    if (isOpen) {
      setApprovedAmount(request.amount)
      setApprovalNote('')
      setProofFile(null)
      setProofImage(null)
      setProofFileName(null)
      setIsDropdownOpen(false)
    }
  }, [isOpen, request.amount])

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])
  
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

  useEffect(() => {
    if (availableLocations.length > 0 && (!cashLocationId || !availableLocations.some(l => l.id === cashLocationId))) {
      setCashLocationId(availableLocations[0].id)
    }
  }, [availableLocations, method, cashLocationId])

  const selectedLocation = availableLocations.find(loc => loc.id === cashLocationId)

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pencairan Dana Petty Cash</h2>
              <p className="text-sm text-slate-500 mt-0.5">Verifikasi rekening & sumber dana pencairan</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Summary Box with Editable Amount */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/60 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">Outlet Pemohon</span>
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-base">
                  <Store className="w-4 h-4 text-amber-500" />
                  {request.outlet?.name || '-'}
                </div>
                <div className="text-xs text-slate-500" title={tanggalWaktu(request.created_at)}>
                  {relativeTime(request.created_at)} ({tanggalWaktu(request.created_at)})
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500">Nominal Diajukan</span>
                <div className="text-base font-bold text-slate-400 line-through decoration-slate-300">
                  Rp {request.amount.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200/60">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Nominal Disetujui (Acc)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-bold text-lg">Rp</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={approvedAmount || ''}
                  onChange={(e) => setApprovedAmount(Number(e.target.value) || 0)}
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-amber-300 focus:border-amber-500 rounded-xl font-bold text-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Ubah nominal ini jika Finance hanya menyetujui sebagian dana.
              </p>
            </div>
            
            {/* Always visible Finance Note Input */}
            <div className="pt-2">
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                Catatan Finance{' '}
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
                    : "Tambahkan catatan instruksi pencairan untuk outlet..."
                }
                className={`w-full px-4 py-3 bg-white border rounded-xl text-sm text-slate-900 focus:outline-none transition-colors ${
                  approvedAmount !== request.amount ? 'border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                }`}
                rows={2}
              />
            </div>
          </div>

          {/* Reason Section */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Alasan Pengajuan (Dari Outlet)</span>
            <p className="text-sm text-slate-800">
              {request.reason || request.description}
            </p>
          </div>

          {/* Target Bank Account Display */}
          <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/70">
            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-amber-900">
              <CreditCard className="w-4 h-4 text-amber-600" />
              <span>Rekening Tujuan Transfer (Outlet)</span>
            </div>

            {request.bank_name ? (
              <div className="grid grid-cols-2 gap-3 text-sm bg-white rounded-xl p-4 border border-amber-200/60 shadow-sm text-slate-700">
                <div>
                  <span className="text-xs text-slate-500 font-semibold block mb-1">Bank</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-500" /> {request.bank_name}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-semibold block mb-1">No. Rekening</span>
                  <span className="font-mono font-bold text-slate-900 text-base">{request.bank_account_number}</span>
                </div>
                <div className="col-span-2 pt-2 mt-1 border-t border-slate-100 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Atas Nama:</span>
                  <span className="font-bold text-slate-900">{request.bank_account_name || '-'}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-4 border border-amber-200 text-sm text-amber-800 flex items-center gap-2.5 font-medium shadow-sm">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Belum ada data rekening resmi terdaftar untuk outlet ini.</span>
              </div>
            )}
          </div>
          
          {/* Method Choice */}
          <div>
            <span className="text-sm font-bold text-slate-700 block mb-3">Metode Pencairan</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label 
                className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  method === 'transfer' 
                    ? 'border-amber-500 bg-amber-50/30' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-900">Transfer Bank</span>
                  <input 
                    type="radio" 
                    name="method" 
                    value="transfer"
                    checked={method === 'transfer'}
                    onChange={() => {
                      setMethod('transfer')
                      setIsDropdownOpen(false)
                    }}
                    className="accent-amber-500 w-4 h-4 cursor-pointer"
                  />
                </div>
                <span className="text-xs text-slate-500">Transfer ke rekening outlet resmi</span>
              </label>

              <label 
                className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  method === 'tunai' 
                    ? 'border-amber-500 bg-amber-50/30' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-900">Beri Tunai</span>
                  <input 
                    type="radio" 
                    name="method" 
                    value="tunai"
                    checked={method === 'tunai'}
                    onChange={() => {
                      setMethod('tunai')
                      setIsDropdownOpen(false)
                    }}
                    className="accent-amber-500 w-4 h-4 cursor-pointer"
                  />
                </div>
                <span className="text-xs text-slate-500">Uang kas fisik dari Kas Pusat</span>
              </label>
            </div>
          </div>

          {/* Custom Cash Location Selector */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Sumber Akun Kas / Bank Pusat ({method === 'transfer' ? 'Rekening Bank' : 'Kas Fisik'})
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full px-4 py-3 bg-white border rounded-xl text-sm font-medium text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                  isDropdownOpen ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm' : 'border-slate-300 hover:border-slate-400 shadow-sm'
                }`}
              >
                {selectedLocation ? (
                  <span className="text-slate-800 font-bold block truncate">
                    {selectedLocation.label} <span className="text-slate-500 font-medium ml-1">(Saldo: Rp {selectedLocation.saldo.toLocaleString('id-ID')})</span>
                  </span>
                ) : (
                  <span className="text-slate-400">-- Pilih Sumber Dana Kas/Bank --</span>
                )}
                <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200 max-h-60 overflow-y-auto">
                  {availableLocations.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">Tidak ada sumber dana tersedia</div>
                  ) : (
                    availableLocations.map(loc => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          setCashLocationId(loc.id)
                          setIsDropdownOpen(false)
                        }}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors hover:bg-amber-50 ${
                          cashLocationId === loc.id ? 'bg-amber-50/50' : ''
                        }`}
                      >
                        <div className="flex flex-col pr-4">
                          <span className={`text-sm font-bold ${cashLocationId === loc.id ? 'text-amber-700' : 'text-slate-800'}`}>
                            {loc.label}
                          </span>
                          <span className="text-slate-500 mt-0.5 text-xs font-medium">
                            Saldo: Rp {loc.saldo.toLocaleString('id-ID')}
                          </span>
                        </div>
                        {cashLocationId === loc.id && (
                          <Check className="w-5 h-5 text-amber-600 shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Photo File Upload Input (FOR TRANSFER BUKTI) */}
          {method === 'transfer' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
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
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50 rounded-2xl cursor-pointer transition-all group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-amber-500 group-hover:border-amber-300 shadow-sm mb-3 transition-colors">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-amber-600 transition-colors">
                    Klik untuk Pilih Foto Bukti Transfer
                  </span>
                  <span className="text-xs text-slate-400 mt-1">Format: JPG, PNG, WEBP (Maksimal 5MB)</span>
                </label>
              ) : (
                <div className="relative bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-4 shadow-sm">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-50 relative">
                    <img src={proofImage} alt="Preview Bukti" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-bold text-slate-800 block truncate">{proofFileName || 'Bukti_Transfer.jpg'}</span>
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Foto dilampirkan
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 transition-colors shrink-0 cursor-pointer"
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
        <div className="px-6 py-5 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isLoading}
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button 
            type="button"
            onClick={() => handleAction('reject')}
            disabled={isLoading && actionType !== 'reject'}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            {isLoading && actionType === 'reject' ? 'Memproses...' : 'Tolak'}
          </button>
          <button 
            type="button"
            onClick={() => handleAction('approve')}
            disabled={isLoading && actionType !== 'approve'}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isLoading && actionType === 'approve' ? 'Memproses...' : 'Acc & Cairkan'}
          </button>
        </div>
      </div>
    </div>
  )
}
