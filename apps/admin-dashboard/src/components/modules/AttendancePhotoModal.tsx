'use client'

import React from 'react'
import { X, Camera, Clock, MapPin, User, Tag, Download, ShieldCheck, Navigation } from 'lucide-react'

export interface AttendancePhotoInfo {
  url: string
  title: string
  timestamp?: string
  staffName?: string
  outletName?: string
  actionType?: string
  notes?: string
  lat?: number | null
  lng?: number | null
}

interface AttendancePhotoModalProps {
  photo: AttendancePhotoInfo | null
  onClose: () => void
}

export function AttendancePhotoModal({ photo, onClose }: AttendancePhotoModalProps) {
  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-md transition-opacity">
      <div className="relative w-full max-w-xl max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-suka-gray-200 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-suka-gray-100 px-4 py-3 sm:px-6 sm:py-4 bg-white">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-suka-orange border border-orange-200">
              <Camera size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-suka-ink truncate">
                  {photo.title}
                </h3>
                <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck size={10} /> Presensi Terverifikasi
                </span>
              </div>
              <p className="text-xs font-semibold text-suka-gray-500 truncate mt-0.5">
                Foto Selfie &amp; Koordinat GPS Presensi
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-suka-gray-400 hover:bg-stone-100 hover:text-suka-ink transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-stone-900 border border-stone-200 flex items-center justify-center min-h-[200px] max-h-[40vh] shadow-inner">
            <img
              src={photo.url}
              alt={photo.title}
              className="max-h-[40vh] w-auto max-w-full object-contain mx-auto"
            />
            {photo.timestamp && (
              <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Clock size={12} />
                {photo.timestamp}
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {photo.staffName && (
              <div className="p-3 bg-[#FDF9F3] rounded-xl border border-suka-brown/10 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-orange-100 text-suka-orange shrink-0">
                  <User size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-suka-gray-500 uppercase font-bold">Karyawan</p>
                  <p className="font-extrabold text-suka-ink text-xs truncate">{photo.staffName}</p>
                </div>
              </div>
            )}

            {photo.outletName && (
              <div className="p-3 bg-[#FDF9F3] rounded-xl border border-suka-brown/10 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-orange-100 text-suka-orange shrink-0">
                  <MapPin size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-suka-gray-500 uppercase font-bold">Outlet</p>
                  <p className="font-extrabold text-suka-ink text-xs truncate">{photo.outletName}</p>
                </div>
              </div>
            )}

            {photo.actionType && (
              <div className="p-3 bg-[#FDF9F3] rounded-xl border border-suka-brown/10 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-orange-100 text-suka-orange shrink-0">
                  <Tag size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-suka-gray-500 uppercase font-bold">Tipe Presensi</p>
                  <p className="font-extrabold text-suka-ink text-xs truncate">{photo.actionType}</p>
                </div>
              </div>
            )}

            {photo.lat && photo.lng && (
              <div className="p-3 bg-[#FDF9F3] rounded-xl border border-suka-brown/10 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-orange-100 text-suka-orange shrink-0">
                  <Navigation size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-suka-gray-500 uppercase font-bold">Koordinat GPS</p>
                  <a
                    href={`https://www.google.com/maps?q=${photo.lat},${photo.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-bold text-blue-600 hover:underline text-xs truncate block"
                  >
                    {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}
                  </a>
                </div>
              </div>
            )}
          </div>

          {photo.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
              <span className="font-bold uppercase tracking-wider block text-[10px] text-amber-800 mb-0.5">
                Catatan / Alasan:
              </span>
              <p className="font-medium">{photo.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-suka-gray-100 px-4 py-3 sm:px-6 sm:py-4 bg-stone-50 gap-2">
          <a
            href={photo.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-stone-100 text-suka-ink border border-suka-gray-200 px-4 py-2 text-xs font-bold transition-colors shadow-xs"
          >
            <Download size={14} /> Unduh Foto
          </a>

          <button
            onClick={onClose}
            className="rounded-xl bg-suka-brown hover:bg-suka-brown/90 text-white font-bold px-6 py-2 text-xs transition-colors shadow-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
