'use client'

import React, { useState } from 'react'
import {
  Check,
  X,
  Clock,
  Loader2,
  AlertTriangle,
  Building2,
  Maximize2,
  User,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react'
import type { PendingWasteItem } from '../actions/waste'

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatWIB = (ts: string) => {
  try {
    const d = new Date(ts)
    return (
      d.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) +
      ' ' +
      d.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) +
      ' WIB'
    )
  } catch {
    return ts
  }
}

interface PendingWasteTabProps {
  items: PendingWasteItem[]
  loading: boolean
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, reason: string) => Promise<void>
}

export default function PendingWasteTab({
  items,
  loading,
  onApprove,
  onReject,
}: PendingWasteTabProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null)
  const [rejectingItem, setRejectingItem] = useState<PendingWasteItem | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSubmittingReject, setIsSubmittingReject] = useState(false)

  const handleApprove = async (id: string) => {
    setProcessingId(id)
    try {
      await onApprove(id)
    } finally {
      setProcessingId(null)
    }
  }

  const openRejectModal = (item: PendingWasteItem) => {
    setRejectingItem(item)
    setRejectionReason('')
  }

  const submitReject = async () => {
    if (!rejectingItem) return
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) return

    setIsSubmittingReject(true)
    try {
      await onReject(rejectingItem.id, rejectionReason.trim())
      setRejectingItem(null)
      setRejectionReason('')
    } finally {
      setIsSubmittingReject(false)
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-suka-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-suka-orange" />
        <p className="text-xs font-bold">Memuat antrean pengajuan waste...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-suka-brown/5 shadow-sm max-w-xl mx-auto my-6">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-suka-brown">Semua Pengajuan Bersih!</h3>
        <p className="text-xs text-suka-gray-500 font-medium mt-1">
          Tidak ada pengajuan waste yang menunggu persetujuan saat ini.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-suka-brown/70">
          Menampilkan <span className="text-suka-orange font-black">{items.length}</span> pengajuan yang butuh tindakan Anda
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => {
          const isProcessing = processingId === item.id

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-suka-brown/10 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
            >
              {/* Header Card */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black bg-suka-cream text-suka-brown border border-suka-brown/10">
                      <Building2 className="w-3.5 h-3.5 text-suka-orange shrink-0" />
                      <span className="truncate max-w-[170px] sm:max-w-[220px]">{item.outlet_name}</span>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-suka-gray-400 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatWIB(item.created_at)}
                  </span>
                </div>

                {/* Item Details */}
                <div className="pt-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-base font-black text-suka-brown tracking-tight">
                        {item.bahan_nama}
                      </h4>
                      <p className="text-xs font-semibold text-suka-gray-500 mt-0.5">
                        Kuantitas: <span className="text-suka-brown font-black">{item.qty} {item.satuan}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-wider block">
                        Estimasi Kerugian
                      </span>
                      <span className="text-base font-black text-red-600">
                        {formatRupiah(item.nilai_waste)}
                      </span>
                    </div>
                  </div>

                  {/* Reason & Reporter */}
                  <div className="mt-3 p-3 rounded-xl bg-suka-gray-50/80 border border-suka-brown/5 space-y-1.5">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-suka-brown font-medium">
                        <span className="font-bold">Alasan:</span> {item.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-suka-gray-500 font-medium">
                      <User className="w-3 h-3 text-suka-gray-400 shrink-0" />
                      <span>Pelapor: <strong className="text-suka-brown">{item.reporter_name}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Photo Proof */}
                {item.photo_url ? (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPhoto({
                          url: item.photo_url!,
                          title: `${item.bahan_nama} - ${item.outlet_name}`,
                        })
                      }
                      className="group relative flex items-center gap-2 p-1.5 rounded-xl border border-suka-brown/10 hover:border-suka-orange/40 bg-white transition-all text-left w-full cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-lg bg-suka-gray-100 overflow-hidden shrink-0 relative">
                        <img
                          src={item.photo_url}
                          alt="Bukti fisik"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-suka-brown group-hover:text-suka-orange transition-colors flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-suka-orange shrink-0" />
                          <span>Lihat Foto Bukti Fisik</span>
                        </p>
                        <p className="text-[10px] text-suka-gray-400">Klik untuk memperbesar gambar</p>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="pt-1 text-[11px] font-semibold text-suka-gray-400 italic">
                    * Tidak ada lampiran foto fisik
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-suka-brown/5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openRejectModal(item)}
                  disabled={isProcessing}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.98] font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  <span>Tolak</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApprove(item.id)}
                  disabled={isProcessing}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Setujui</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Lightbox Foto */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-white/20">
            <div className="p-4 border-b border-suka-brown/10 flex items-center justify-between">
              <h4 className="text-sm font-black text-suka-brown truncate">
                {selectedPhoto.title}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="w-8 h-8 rounded-full bg-suka-gray-100 flex items-center justify-center text-suka-brown hover:bg-suka-gray-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 bg-suka-gray-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={selectedPhoto.url}
                alt="Bukti fisik waste"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Alasan Penolakan */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-suka-brown/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-suka-brown">Tolak Pengajuan Waste</h3>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                disabled={isSubmittingReject}
                className="w-8 h-8 rounded-full bg-suka-gray-100 flex items-center justify-center text-suka-brown hover:bg-suka-gray-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-red-50/60 rounded-xl border border-red-100 text-xs text-suka-brown space-y-1">
              <p>
                <strong>Bahan:</strong> {rejectingItem.bahan_nama} ({rejectingItem.qty} {rejectingItem.satuan})
              </p>
              <p>
                <strong>Outlet:</strong> {rejectingItem.outlet_name}
              </p>
              <p>
                <strong>Alasan Kru:</strong> {rejectingItem.reason}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-suka-brown block">
                Alasan Penolakan <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Tuliskan catatan alasan penolakan untuk kru outlet (cth: Foto tidak jelas, sisa porsi masih bisa diolah, dll)..."
                rows={3}
                disabled={isSubmittingReject}
                className="w-full text-xs p-3 rounded-xl border border-suka-brown/20 focus:outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange bg-white resize-none"
              />
              <p className="text-[10px] text-suka-gray-400">Minimal 3 karakter.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                disabled={isSubmittingReject}
                className="px-4 py-2 rounded-xl text-xs font-bold text-suka-brown hover:bg-suka-gray-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitReject}
                disabled={isSubmittingReject || rejectionReason.trim().length < 3}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Konfirmasi Tolak</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
