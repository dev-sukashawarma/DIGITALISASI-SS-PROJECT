'use client'

import React from 'react'
import { X, Camera, Clock, MapPin, User, Tag, Download, ShieldCheck } from 'lucide-react'

export interface StealthPhotoInfo {
  url: string
  title: string
  timestamp?: string
  staffName?: string
  outletName?: string
  actionType?: string
  notes?: string
}

interface StealthPhotoModalProps {
  photo: StealthPhotoInfo | null
  onClose: () => void
}

export function StealthPhotoModal({ photo, onClose }: StealthPhotoModalProps) {
  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 backdrop-blur-md transition-opacity">
      <div className="relative w-full max-w-xl max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4 bg-white">
          <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
            <div className="shrink-0 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-orange-50 text-suka-orange border border-orange-100 shadow-sm">
              <Camera size={18} className="sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="font-extrabold text-xs sm:text-base text-slate-900 truncate max-w-[180px] sm:max-w-none">
                  {photo.title}
                </h3>
                <span className="shrink-0 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck size={10} /> Foto Otomatis Terverifikasi
                </span>
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate mt-0.5">Audit Presensi & Bukti Foto Otomatis</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 sm:p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-5">
          {/* Main Photo Display */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-slate-950 border border-slate-200 flex items-center justify-center min-h-[160px] max-h-[32vh] sm:max-h-[42vh] shadow-inner group">
            <img
              src={photo.url}
              alt={photo.title}
              className="max-h-[32vh] sm:max-h-[42vh] w-auto max-w-full object-contain mx-auto"
            />

            {/* Timestamp Watermark Overlay */}
            {photo.timestamp && (
              <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-mono text-emerald-400 border border-emerald-500/30 shadow-md flex items-center gap-1">
                <Clock size={12} />
                {photo.timestamp}
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs">
            {photo.staffName && (
              <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100">
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-orange-100/60 text-suka-orange shrink-0">
                  <User size={14} className="sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-extrabold tracking-wider truncate">Karyawan</p>
                  <p className="font-black text-slate-900 text-xs sm:text-sm mt-0.5 truncate">{photo.staffName}</p>
                </div>
              </div>
            )}

            {photo.outletName && (
              <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100">
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-orange-100/60 text-suka-orange shrink-0">
                  <MapPin size={14} className="sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-extrabold tracking-wider truncate">Outlet</p>
                  <p className="font-black text-slate-900 text-xs sm:text-sm mt-0.5 truncate">{photo.outletName}</p>
                </div>
              </div>
            )}

            {photo.actionType && (
              <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100">
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-orange-100/60 text-suka-orange shrink-0">
                  <Tag size={14} className="sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-extrabold tracking-wider truncate">Tipe Presensi</p>
                  <p className="font-black text-slate-900 text-xs sm:text-sm mt-0.5 truncate">{photo.actionType}</p>
                </div>
              </div>
            )}

            {photo.timestamp && (
              <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100">
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-orange-100/60 text-suka-orange shrink-0">
                  <Clock size={14} className="sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-extrabold tracking-wider truncate">Waktu Presensi</p>
                  <p className="font-black text-slate-900 text-xs sm:text-sm mt-0.5 truncate">{photo.timestamp}</p>
                </div>
              </div>
            )}
          </div>

          {photo.notes && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-xs text-amber-900">
              <span className="font-extrabold uppercase tracking-wider block text-[9px] sm:text-[10px] text-amber-700 mb-0.5">Catatan / Alasan:</span>
              <p className="font-medium text-slate-800 leading-relaxed text-xs">{photo.notes}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-6 sm:py-4 bg-slate-50/50 gap-2">
          <a
            href={photo.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 sm:px-4 text-[11px] sm:text-xs font-bold transition-colors shadow-sm"
          >
            <Download size={13} /> Unduh Foto
          </a>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 sm:px-6 text-[11px] sm:text-xs transition-colors shadow-sm"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
