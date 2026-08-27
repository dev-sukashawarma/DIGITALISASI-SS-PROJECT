'use client'

import React from 'react'
import { 
  X, 
  User, 
  CreditCard, 
  FileText, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  Calendar, 
  Percent, 
  ShieldCheck, 
  BadgeHelp,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import type { MitraBiodata } from '@/app/actions/mitraProfile'

interface MitraBiodataModalProps {
  isOpen: boolean
  onClose: () => void
  biodata: MitraBiodata | null
  outletNames: string[]
}

export function MitraBiodataModal({ isOpen, onClose, biodata, outletNames }: MitraBiodataModalProps) {
  if (!isOpen) return null

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date(dateStr))
    } catch {
      return dateStr
    }
  }

  const isExpired = biodata?.tanggal_berakhir_pks 
    ? new Date(biodata.tanggal_berakhir_pks).getTime() < Date.now()
    : false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#2A1D16]/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-amber-100 overflow-hidden z-10 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#38261C] to-[#251A14] text-white p-6 sm:p-7">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold tracking-wider uppercase border border-amber-400/30">
              Dokumen Resmi Mitra
            </span>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              biodata?.status === 'nonaktif' 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {biodata?.status === 'nonaktif' ? (
                <><AlertCircle className="w-3 h-3" /> Nonaktif</>
              ) : (
                <><CheckCircle2 className="w-3 h-3" /> Mitra Aktif</>
              )}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Biodata & Legalitas Kemitraan
          </h2>
          <p className="text-white/70 text-xs sm:text-sm mt-1 font-normal">
            Data identitas resmi terdaftar, rekening tujuan bagi hasil, dan nomor perjanjian kerjasama.
          </p>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-5">
          
          {/* Section 1: Profil Pribadi */}
          <div className="bg-[#FAF7F2] rounded-2xl p-4 sm:p-5 border border-amber-200/60 space-y-3.5">
            <div className="flex items-center gap-2 text-[#2A1D16] font-semibold text-xs uppercase tracking-wider pb-2 border-b border-amber-200/50">
              <User className="w-4 h-4 text-amber-600" />
              <span>Identitas Mitra</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5">Nama Lengkap</span>
                <span className="text-[#2A1D16] font-bold text-sm">{biodata?.nama_mitra || '-'}</span>
              </div>
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5">Nomor Induk Kependudukan (NIK)</span>
                <span className="text-[#2A1D16] font-mono font-semibold text-sm">
                  {biodata?.nik || <span className="text-gray-400 italic font-normal">Belum terisi</span>}
                </span>
              </div>
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-amber-600" /> No. WhatsApp / Telepon
                </span>
                <span className="text-[#2A1D16] font-semibold">
                  {biodata?.phone || <span className="text-gray-400 italic font-normal">Belum terisi</span>}
                </span>
              </div>
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-amber-600" /> Alamat Email
                </span>
                <span className="text-[#2A1D16] font-semibold">
                  {biodata?.email || <span className="text-gray-400 italic font-normal">Belum terisi</span>}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[#8C7566] font-medium block mb-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-600" /> Alamat Domisili
                </span>
                <span className="text-[#2A1D16] font-normal leading-relaxed">
                  {biodata?.alamat_domisili || <span className="text-gray-400 italic">Belum terisi</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Rekening Bank Bagi Hasil */}
          <div className="bg-amber-50/50 rounded-2xl p-4 sm:p-5 border border-amber-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200/50">
              <div className="flex items-center gap-2 text-[#2A1D16] font-semibold text-xs uppercase tracking-wider">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <span>Rekening Bank Bagi Hasil</span>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                Tujuan Transfer
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5 flex items-center gap-1">
                  <Building className="w-3 h-3 text-amber-600" /> Nama Bank
                </span>
                <span className="text-[#2A1D16] font-bold text-sm">
                  {biodata?.bank_name || <span className="text-gray-400 italic font-normal">Belum terisi</span>}
                </span>
              </div>
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5">Nomor Rekening</span>
                <span className="text-amber-700 font-mono font-bold text-sm">
                  {biodata?.bank_account_number || <span className="text-gray-400 italic font-normal">Belum terisi</span>}
                </span>
              </div>
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5">Atas Nama</span>
                <span className="text-[#2A1D16] font-semibold text-sm">
                  {biodata?.bank_account_holder || <span className="text-gray-400 italic font-normal">Belum terisi</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Perjanjian Kerjasama (PKS) */}
          <div className="bg-[#FAF7F2] rounded-2xl p-4 sm:p-5 border border-amber-200/60 space-y-3.5">
            <div className="flex items-center gap-2 text-[#2A1D16] font-semibold text-xs uppercase tracking-wider pb-2 border-b border-amber-200/50">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Legalitas & Perjanjian Kerjasama</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5">Nomor Surat PKS</span>
                <span className="text-[#2A1D16] font-mono font-semibold text-xs">
                  {biodata?.no_pks || <span className="text-gray-400 italic font-normal">Belum terisi</span>}
                </span>
              </div>
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-600" /> Tanggal Mulai
                </span>
                <span className="text-[#2A1D16] font-semibold">
                  {formatDate(biodata?.tanggal_pks)}
                </span>
              </div>
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-600" /> Berakhir Pada
                </span>
                <span className={`font-semibold ${isExpired ? 'text-rose-500' : 'text-[#2A1D16]'}`}>
                  {formatDate(biodata?.tanggal_berakhir_pks)} {isExpired && '(Kedaluwarsa)'}
                </span>
              </div>
              <div>
                <span className="text-[#8C7566] font-medium block mb-0.5 flex items-center gap-1">
                  <Percent className="w-3 h-3 text-amber-600" /> Skema Bagi Hasil
                </span>
                <span className="text-amber-700 font-bold text-sm">
                  {biodata?.profit_sharing_pct ?? 50}% Laba Bersih
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[#8C7566] font-medium block mb-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Outlet Terhubung
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {outletNames.length > 0 ? (
                    outletNames.map((name, i) => (
                      <span key={i} className="px-2.5 py-0.5 bg-white border border-amber-200/80 rounded-lg font-medium text-[#2A1D16] text-xs">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 italic font-normal">Belum ada outlet</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="flex items-start gap-3 p-3.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900">
            <BadgeHelp className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-normal">
              Jika terdapat perubahan nomor rekening, alamat domisili, atau perpanjangan PKS, silakan ajukan melalui tab <strong>Saran & Kritik</strong> atau hubungi Admin Pusat.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-[#38261C] hover:bg-[#251A14] text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-xs"
          >
            Tutup Biodata
          </button>
        </div>
      </div>
    </div>
  )
}
