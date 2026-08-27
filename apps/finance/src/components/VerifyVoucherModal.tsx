'use client'

import { useState } from 'react'
import { X, CheckCircle2, XCircle, FileText, ExternalLink, ShieldCheck } from 'lucide-react'
import { type OfficeVoucher } from '@/lib/officeVoucher'

interface VerifyVoucherModalProps {
  voucher: OfficeVoucher | null
  isOpen: boolean
  onClose: () => void
  onVerify: (data: { voucher: OfficeVoucher; approvedAmount?: number }) => Promise<void>
  onReject: (data: { voucher: OfficeVoucher; reason: string }) => Promise<void>
  isProcessing: boolean
}

export function VerifyVoucherModal({
  voucher,
  isOpen,
  onClose,
  onVerify,
  onReject,
  isProcessing
}: VerifyVoucherModalProps) {
  const [approvedAmount, setApprovedAmount] = useState<number | ''>(voucher?.realizedAmount || voucher?.advanceAmount || '')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  if (!isOpen || !voucher) return null

  const advance = voucher.advanceAmount || 0
  const real = voucher.realizedAmount || advance
  const refund = Math.max(0, advance - real)

  const handleApprove = async () => {
    await onVerify({
      voucher,
      approvedAmount: Number(approvedAmount) || real
    })
    onClose()
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectReason.trim()) {
      alert('Alasan penolakan wajib diisi!')
      return
    }
    await onReject({
      voucher,
      reason: rejectReason.trim()
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Verifikasi OPEX Kantor</h3>
              <p className="text-xs text-gray-500">Nomor Voucher: <strong className="text-gray-900">{voucher.voucherNumber}</strong></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voucher Detailed Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-xs flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-400 block font-medium">Divisi Pemohon:</span>
              <span className="font-bold text-gray-800">{voucher.division}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">Nama Pemohon:</span>
              <span className="font-bold text-gray-800">{voucher.recipientName}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60">
            <div>
              <span className="text-gray-400 block font-medium">Kategori OPEX:</span>
              <span className="font-bold text-amber-700">{voucher.categoryLabel}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">Tanggal Pengajuan:</span>
              <span className="font-bold text-gray-800">{voucher.date}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200/60">
            <span className="text-gray-400 block font-medium">Keperluan Belanja:</span>
            <p className="font-medium text-gray-700 mt-0.5">{voucher.reason}</p>
          </div>
        </div>

        {/* Amount Breakdown */}
        <div className="grid grid-cols-3 gap-2.5 mb-4 text-center">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-[10px] font-bold text-amber-800 uppercase block">Uang Muka</span>
            <span className="text-xs font-black text-amber-900">Rp {advance.toLocaleString('id-ID')}</span>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
            <span className="text-[10px] font-bold text-blue-800 uppercase block">Riil Struk</span>
            <span className="text-xs font-black text-blue-900">Rp {real.toLocaleString('id-ID')}</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Kembalian</span>
            <span className="text-xs font-black text-emerald-900">Rp {refund.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Edit Approved Amount if needed */}
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <label className="text-xs font-bold text-gray-700 block">
            <span className="mb-1 block">Nominal Akhir yang Disetujui Masuk OPEX (Rp):</span>
            <input
              type="number"
              min="1"
              value={approvedAmount}
              onChange={(e) => setApprovedAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-900 outline-none focus:border-amber-500"
            />
          </label>
        </div>

        {/* Receipt Attachment Review */}
        <div className="mb-4">
          <span className="text-xs font-bold text-gray-700 block mb-1.5">Bukti Struk / Invoice Terlampir:</span>
          {voucher.receiptUrl ? (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-2 flex flex-col items-center">
              {voucher.receiptUrl.match(/\.(jpeg|jpg|png|webp|gif)/i) || voucher.receiptUrl.startsWith('data:image') ? (
                <img
                  src={voucher.receiptUrl}
                  alt="Bukti Nota"
                  className="max-h-48 rounded-lg object-contain mb-2"
                />
              ) : (
                <div className="py-6 flex flex-col items-center text-gray-500">
                  <FileText className="w-10 h-10 text-gray-400 mb-1" />
                  <span className="text-xs">Dokumen Invoice Terlampir</span>
                </div>
              )}
              <a
                href={voucher.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 mt-1"
              >
                Buka Bukti Ukuran Penuh <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              ⚠️ Belum ada file foto nota yang diupload.
            </div>
          )}
        </div>

        {/* Action Controls */}
        {showRejectForm ? (
          <form onSubmit={handleRejectSubmit} className="flex flex-col gap-3 pt-3 border-t border-gray-100">
            <label className="text-xs font-bold text-rose-700">
              <span className="mb-1 block">Alasan Penolakan:</span>
              <textarea
                rows={2}
                placeholder="Contoh: Bukti nota buram / barang tidak sesuai peruntukan"
                className="w-full rounded-xl border border-rose-200 p-2.5 text-xs outline-none focus:border-rose-500"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </form>
        ) : (
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              disabled={isProcessing}
              className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 font-bold px-3 py-2 rounded-xl text-xs hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4" /> Tolak Pengajuan
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-3.5 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm shadow-emerald-200 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isProcessing ? 'Memproses...' : 'Setujui & Masukkan ke OPEX'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
