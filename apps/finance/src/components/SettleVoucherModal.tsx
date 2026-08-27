'use client'

import { useState } from 'react'
import { X, UploadCloud, AlertCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { type OfficeVoucher } from '@/lib/officeVoucher'
import { createClient } from '@/lib/supabase'

interface SettleVoucherModalProps {
  voucher: OfficeVoucher | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    voucher: OfficeVoucher
    realizedAmount: number
    receiptUrl?: string | null
    notes?: string
  }) => Promise<void>
  isSubmitting: boolean
}

export function SettleVoucherModal({
  voucher,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting
}: SettleVoucherModalProps) {
  const [realizedAmount, setRealizedAmount] = useState<number | ''>(voucher?.advanceAmount || '')
  const [receiptUrl, setReceiptUrl] = useState<string>(voucher?.receiptUrl || '')
  const [notes, setNotes] = useState<string>(voucher?.notes || '')
  const [uploading, setUploading] = useState(false)

  if (!isOpen || !voucher) return null

  const advance = voucher.advanceAmount || 0
  const real = typeof realizedAmount === 'number' ? realizedAmount : 0
  const diff = advance - real // >0 = Kembalian ke kas, <0 = Kurang bayar / reimbursement tambahan

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const fileName = `office_receipts/${voucher.voucherNumber}_${Date.now()}.${ext}`

      const { error } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, { upsert: true })

      if (error) {
        // Fallback: use FileReader base64 or public URL
        console.warn('Storage upload error, using fallback:', error.message)
        const reader = new FileReader()
        reader.onload = () => {
          setReceiptUrl(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(fileName)
        setReceiptUrl(publicUrlData.publicUrl)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!realizedAmount || Number(realizedAmount) <= 0) {
      alert('Nominal riil belanja wajib diisi dan lebih dari 0!')
      return
    }

    await onSubmit({
      voucher,
      realizedAmount: Number(realizedAmount),
      receiptUrl: receiptUrl || null,
      notes: notes.trim()
    })
    onClose()
  }

  const inputCls = "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Upload Nota & Realisasi Biaya</h3>
            <p className="text-xs text-gray-500 mt-0.5">Voucher: <strong className="text-amber-600">{voucher.voucherNumber}</strong></p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voucher Quick Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 mb-4 text-xs flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Pemohon / Divisi:</span>
            <span className="font-bold text-gray-800">{voucher.recipientName} ({voucher.division})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Uang Muka Diberikan:</span>
            <span className="font-bold text-gray-900">Rp {advance.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Keperluan:</span>
            <span className="text-gray-700 font-medium truncate max-w-[240px]">{voucher.reason}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          <label className="text-xs font-bold text-gray-700">
            <span className="mb-1 block">Total Nominal Riil Sesuai Struk / Invoice (Rp)</span>
            <input
              type="number"
              min="1"
              className={inputCls}
              value={realizedAmount}
              onChange={(e) => setRealizedAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Contoh: 94000"
              required
            />
          </label>

          {/* Refund / Difference Calculation Box */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            diff > 0 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : diff < 0 
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
            <div className="flex items-center gap-2">
              {diff > 0 ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> : diff < 0 ? <ArrowUpRight className="w-4 h-4 text-rose-600" /> : <AlertCircle className="w-4 h-4 text-blue-600" />}
              <span className="font-bold">
                {diff > 0 ? 'Sisa Kembalian ke Kas Kantor:' : diff < 0 ? 'Kurang Bayar (Reimburse Tambahan):' : 'Nominal Pas (Sesuai Uang Muka)'}
              </span>
            </div>
            <span className="text-sm font-black">
              Rp {Math.abs(diff).toLocaleString('id-ID')}
            </span>
          </div>

          {/* Upload Receipt / Invoice */}
          <div>
            <span className="mb-1 block text-xs font-bold text-gray-700">Foto Bukti Nota / Struk / Invoice</span>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-xl p-4 cursor-pointer transition-colors bg-gray-50/50 hover:bg-amber-50/30">
              <UploadCloud className="w-7 h-7 text-gray-400 mb-1" />
              <span className="text-xs font-bold text-gray-700">
                {uploading ? 'Mengupload foto...' : receiptUrl ? 'Ganti Foto Struk' : 'Klik untuk Upload Foto / File Struk'}
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, PDF (Maks 5MB)</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            {receiptUrl && (
              <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800 font-medium">
                <span>✅ Bukti struk terlampir</span>
                <a href={receiptUrl} target="_blank" rel="noreferrer" className="underline font-bold text-emerald-700 hover:text-emerald-900">
                  Lihat File
                </a>
              </div>
            )}
          </div>

          <label className="text-xs font-bold text-gray-700">
            <span className="mb-1 block">Catatan Realisasi (Opsional)</span>
            <textarea
              rows={2}
              placeholder="Catatan tambahan realisasi barang/sisa uang..."
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="mt-2 flex justify-end gap-2.5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || uploading}
              className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm shadow-blue-200 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Menyimpan...' : 'Ajukan Verifikasi Finance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
