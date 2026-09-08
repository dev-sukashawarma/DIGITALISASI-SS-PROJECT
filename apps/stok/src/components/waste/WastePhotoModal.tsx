'use client'

import React, { useEffect, useState } from 'react'
import { X, ExternalLink, ImageOff, Loader2 } from 'lucide-react'

interface WastePhotoModalProps {
  photoUrl: string | null
  title: string
  subtitle?: string
  onClose: () => void
}

export function WastePhotoModal({ photoUrl, title, subtitle, onClose }: WastePhotoModalProps) {
  const [imageError, setImageError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />
      <div className="relative bg-white border border-[#d9c2b2]/60 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-[#d9c2b2]/30 bg-[#faf2e9]/40">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#6d3900] bg-[#ffdcc2] px-2 py-0.5 rounded">
              Foto Bukti Fisik
            </span>
            <h3 className="font-black text-[#701604] text-base leading-tight mt-1 truncate max-w-[280px] sm:max-w-md">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[#544437]/70 font-semibold mt-0.5 truncate max-w-[280px] sm:max-w-md">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#d9c2b2]/40 text-[#544437] hover:bg-[#faf2e9] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-y-auto flex items-center justify-center bg-[#faf2e9]/20 min-h-[250px]">
          {!photoUrl || imageError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-[#544437]/60">
              <div className="w-12 h-12 rounded-2xl bg-[#faf2e9] border border-[#d9c2b2]/40 flex items-center justify-center mb-2">
                <ImageOff className="w-6 h-6 text-[#544437]/40" />
              </div>
              <p className="text-sm font-bold text-[#544437]">Foto Tidak Tersedia</p>
              <p className="text-xs text-[#544437]/60 mt-1">Laporan ini tidak memiliki URL bukti foto yang valid.</p>
            </div>
          ) : (
            <div className="relative w-full flex items-center justify-center">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-xs rounded-2xl min-h-[200px]">
                  <Loader2 className="w-8 h-8 animate-spin text-suka-orange" />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={title}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false)
                  setImageError(true)
                }}
                className="max-h-[60vh] w-auto max-w-full rounded-2xl object-contain border border-[#d9c2b2]/40 shadow-xs"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 px-5 bg-white border-t border-[#d9c2b2]/30 flex items-center justify-between">
          {photoUrl && !imageError ? (
            <a
              href={photoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-suka-orange hover:text-orange-700 transition-colors"
            >
              <span>Buka Ukuran Asli</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#faf2e9] hover:bg-[#f0dfcf] text-[#544437] font-bold text-xs rounded-xl transition-colors cursor-pointer border border-[#d9c2b2]/50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
