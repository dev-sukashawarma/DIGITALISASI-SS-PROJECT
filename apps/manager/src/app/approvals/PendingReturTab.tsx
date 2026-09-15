'use client'

import React, { useState } from 'react'
import {
  Check,
  X,
  Clock,
  Loader2,
  Building2,
  Maximize2,
  User,
  CheckCircle2,
  RotateCcw,
  Scale,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'
import type { ReturApprovalItem } from '../actions/retur'

const getTimeAgo = (dateString: string) => {
  try {
    const diffMs = new Date().getTime() - new Date(dateString).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins} Menit lalu`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} Jam lalu`
    return `${Math.floor(diffHours / 24)} Hari lalu`
  } catch {
    return dateString
  }
}

interface PendingReturTabProps {
  items: ReturApprovalItem[]
  loading: boolean
  onApprove: (id: string, note?: string) => Promise<void>
  onReject: (id: string, note: string) => Promise<void>
}

export default function PendingReturTab({
  items,
  loading,
  onApprove,
  onReject,
}: PendingReturTabProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [approveModalItem, setApproveModalItem] = useState<ReturApprovalItem | null>(null)
  const [rejectModalItem, setRejectModalItem] = useState<ReturApprovalItem | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleConfirmApprove = async () => {
    if (!approveModalItem) return
    setProcessingId(approveModalItem.id)
    try {
      await onApprove(approveModalItem.id, actionNote.trim() || undefined)
      setApproveModalItem(null)
      setActionNote('')
    } finally {
      setProcessingId(null)
    }
  }

  const handleConfirmReject = async () => {
    if (!rejectModalItem || !actionNote.trim()) return
    setProcessingId(rejectModalItem.id)
    try {
      await onReject(rejectModalItem.id, actionNote.trim())
      setRejectModalItem(null)
      setActionNote('')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-suka-brown/5">
        <Loader2 className="w-8 h-8 animate-spin text-suka-orange mx-auto" />
        <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">
          Memuat pengajuan retur...
        </p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-suka-brown/5 p-12 text-center space-y-3 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-100">
          <RotateCcw className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-base text-suka-brown">Tidak Ada Pengajuan Retur</h3>
        <p className="text-xs text-suka-gray-500 max-w-sm mx-auto font-medium">
          Saat ini tidak ada pengembalian bahan baku sensitif (Ayam, Sapi, Kulit) yang menunggu persetujuan Manager.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((retur) => {
        const isProcessing = processingId === retur.id

        return (
          <div
            key={retur.id}
            className="bg-white rounded-2xl border border-suka-brown/10 p-5 shadow-xs hover:shadow-md transition-all space-y-4"
          >
            {/* Header: Nomor Retur, Outlet, Tanggal */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-suka-brown/5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-extrabold text-white bg-suka-brown px-2.5 py-1 rounded-lg">
                  {retur.nomor_retur}
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-suka-brown">
                  <Building2 size={14} className="text-suka-orange" />
                  <span>{retur.outlet_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-suka-gray-400 font-medium">
                <div className="flex items-center gap-1">
                  <User size={12} />
                  <span>
                    {retur.created_by_name} ({retur.created_by_role})
                  </span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>{getTimeAgo(retur.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Item List */}
            <div className="space-y-3">
              {retur.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-suka-cream/30 rounded-xl border border-suka-brown/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-suka-brown truncate">
                        {item.bahan_nama}
                      </h4>
                      <span className="text-xs font-extrabold text-suka-orange bg-suka-orange/10 px-2 py-0.5 rounded-md">
                        {item.qty_klaim} {item.satuan}
                        {item.faktor_tampilan && item.satuan_kecil ? (
                          <span className="text-[10px] font-normal text-suka-brown/70 ml-1">
                            ({item.qty_klaim * item.faktor_tampilan} {item.satuan_kecil})
                          </span>
                        ) : null}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                        Alasan: {item.alasan}
                      </span>
                      {item.catatan && (
                        <span className="text-[11px] text-suka-gray-500 italic">
                          &ldquo;{item.catatan}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Photo Evidence Preview */}
                  {item.foto_fisik_url && (
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPhoto(item.foto_fisik_url)}
                        className="group relative w-16 h-16 rounded-xl overflow-hidden border border-suka-brown/10 bg-black/5 hover:opacity-90 transition-all cursor-pointer"
                        title="Klik untuk memperbesar bukti timbangan"
                      >
                        <img
                          src={item.foto_fisik_url}
                          alt="Bukti fisik timbangan"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 size={14} />
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white font-bold text-center py-0.5">
                          Timbangan
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setRejectModalItem(retur)
                  setActionNote('')
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <X size={14} /> Tolak Retur
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setApproveModalItem(retur)
                  setActionNote('')
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-suka-orange hover:bg-suka-orange/90 shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Setujui Retur
              </button>
            </div>
          </div>
        )
      })}

      {/* Modal Lightbox Foto */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-suka-brown text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Scale size={16} className="text-amber-400" />
                <span>Foto Bahan Baku di Atas Timbangan</span>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 bg-[#1e1b15] flex items-center justify-center min-h-[300px]">
              <img
                src={selectedPhoto}
                alt="Foto bukti pembesaran"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
            <div className="p-3 bg-white text-center text-xs text-suka-gray-500 font-medium">
              Pastikan angka gramatur di timbangan dan fisik bahan baku terlihat jelas sebelum konfirmasi.
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Setujui */}
      {approveModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-suka-brown/10">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-suka-brown">Setujui Klaim Retur?</h3>
                <p className="text-xs text-suka-gray-500 font-mono font-bold">
                  {approveModalItem.nomor_retur} • {approveModalItem.outlet_name}
                </p>
              </div>
            </div>

            <p className="text-xs text-suka-gray-600 leading-relaxed">
              Setelah disetujui, outlet berhak menyerahkan fisik bahan baku ke kurir ekspedisi untuk dikirimkan kembali ke Central Kitchen.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-suka-brown uppercase tracking-wider block">
                Catatan Manajerial (Opsional):
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Contoh: Disetujui, segera kirim dengan Lalamove..."
                rows={2}
                className="w-full text-xs p-3 rounded-xl border border-suka-brown/15 focus:outline-none focus:ring-2 focus:ring-suka-orange/30 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => setApproveModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-suka-gray-500 hover:bg-suka-gray-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={processingId !== null}
                onClick={handleConfirmApprove}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {processingId ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Konfirmasi Persetujuan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Tolak */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-red-100">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-suka-brown">Tolak Klaim Retur?</h3>
                <p className="text-xs text-suka-gray-500 font-mono font-bold">
                  {rejectModalItem.nomor_retur} • {rejectModalItem.outlet_name}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">Perhatian Ledger:</p>
              <p className="text-[11px] leading-relaxed">
                Jika ditolak, kuantitas bahan yang terpotong di outlet akan <strong>dialihkan otomatis menjadi Waste</strong> (kerugian outlet bersangkutan) dan tidak diterbitkan Surat Jalan Pengganti.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-red-700 uppercase tracking-wider block">
                Alasan Penolakan (Wajib Diisi):
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Jelaskan alasan penolakan, misal: Foto bukti tidak jelas / bahan rusak karena kelalaian penyimpanan chiller..."
                rows={3}
                required
                className="w-full text-xs p-3 rounded-xl border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => setRejectModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-suka-gray-500 hover:bg-suka-gray-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={processingId !== null || !actionNote.trim()}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {processingId ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Tolak Klaim Retur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
