'use client'

import { useState } from 'react'
import { X, Printer, CheckCircle2, ArrowRight } from 'lucide-react'
import { OFFICE_DIVISIONS, type OfficeDivision, type OfficeVoucher } from '@/lib/officeVoucher'
import { PENGELUARAN_CATEGORIES, CATEGORY_META, type ExpenseCategory } from '@/lib/expenseCategories'
import { generateVoucherPDF } from '@/utils/voucherPdfGenerator'

interface CreateVoucherModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    date: string
    division: OfficeDivision
    recipientName: string
    category: ExpenseCategory
    advanceAmount: number
    reason: string
    paymentSource: string
  }) => Promise<OfficeVoucher | null | undefined>
  isSubmitting: boolean
}

export function CreateVoucherModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting
}: CreateVoucherModalProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [division, setDivision] = useState<OfficeDivision>('Marketing & Growth')
  const [recipientName, setRecipientName] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>(PENGELUARAN_CATEGORIES[0])
  const [advanceAmount, setAdvanceAmount] = useState<number | ''>('')
  const [reason, setReason] = useState('')
  const [paymentSource, setPaymentSource] = useState('petty_cash')

  // Success state for instant print
  const [createdVoucher, setCreatedVoucher] = useState<OfficeVoucher | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientName.trim()) {
      alert('Nama pemohon / penerima wajib diisi!')
      return
    }
    if (!advanceAmount || Number(advanceAmount) <= 0) {
      alert('Nominal uang muka harus lebih dari 0!')
      return
    }
    if (!reason.trim()) {
      alert('Keperluan penggunaan dana wajib diisi!')
      return
    }

    const res = await onSubmit({
      date,
      division,
      recipientName: recipientName.trim(),
      category,
      advanceAmount: Number(advanceAmount),
      reason: reason.trim(),
      paymentSource
    })

    if (res) {
      setCreatedVoucher(res)
    }
  }

  const handlePrint = () => {
    if (createdVoucher) {
      generateVoucherPDF(createdVoucher)
    }
  }

  const handleFinish = () => {
    setCreatedVoucher(null)
    onClose()
  }

  const inputCls = "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {createdVoucher ? 'Pengajuan Dana Berhasil Dibuat' : 'Pengajuan Dana Kas Kantor (Advance)'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {createdVoucher ? 'Voucher kas siap dicetak untuk tanda tangan' : 'Input data pengeluaran dana tunai/transfer untuk kebutuhan tim kantor'}
            </p>
          </div>
          <button
            onClick={createdVoucher ? handleFinish : onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdVoucher ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-gray-900">Nomor Voucher: {createdVoucher.voucherNumber}</h4>
            <p className="text-sm text-gray-600 mt-1 max-w-sm">
              Uang muka sebesar <strong className="text-gray-900">Rp {createdVoucher.advanceAmount.toLocaleString('id-ID')}</strong> untuk <strong>{createdVoucher.recipientName}</strong> ({createdVoucher.division}) telah tercatat di sistem.
            </p>

            <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 my-5 text-left text-xs text-amber-900 flex flex-col gap-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <span>📄</span> Langkah Selanjutnya:
              </p>
              <p>1. Cetak formulir voucher kas di bawah ini untuk ditandatangani saat penyerahan uang.</p>
              <p>2. Setelah staf membeli barang, minta nota/struk asli dan upload ke sistem untuk verifikasi Finance.</p>
            </div>

            <div className="flex items-center gap-3 w-full justify-center">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-amber-200 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Cetak Voucher (PDF)
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-5 py-2.5 rounded-xl text-sm transition-all cursor-pointer"
              >
                Selesai & Tutup <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-gray-700">
                <span className="mb-1 block">Tanggal Pengajuan</span>
                <input
                  type="date"
                  className={inputCls}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>

              <label className="text-xs font-bold text-gray-700">
                <span className="mb-1 block">Divisi Pemohon</span>
                <select
                  className={inputCls}
                  value={division}
                  onChange={(e) => setDivision(e.target.value as OfficeDivision)}
                >
                  {OFFICE_DIVISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-gray-700">
                <span className="mb-1 block">Nama Pemohon / Penerima Dana</span>
                <input
                  type="text"
                  placeholder="Contoh: Budi (Staff IT)"
                  className={inputCls}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                />
              </label>

              <label className="text-xs font-bold text-gray-700">
                <span className="mb-1 block">Kategori OPEX</span>
                <select
                  className={inputCls}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                >
                  {PENGELUARAN_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_META[c]?.label || c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-gray-700">
                <span className="mb-1 block">Nominal Uang Muka (Rp)</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Contoh: 150000"
                  className={inputCls}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
              </label>

              <label className="text-xs font-bold text-gray-700">
                <span className="mb-1 block">Sumber Dana</span>
                <select
                  className={inputCls}
                  value={paymentSource}
                  onChange={(e) => setPaymentSource(e.target.value)}
                >
                  <option value="petty_cash">💵 Kas Tunai Kantor (Petty Cash)</option>
                  <option value="transfer_pusat">💳 Transfer Bank / Rekening Pusat</option>
                </select>
              </label>
            </div>

            <label className="text-xs font-bold text-gray-700">
              <span className="mb-1 block">Keperluan / Uraian Belanja</span>
              <textarea
                rows={3}
                placeholder="Contoh: Beli kabel HDMI, stop kontak, dan kertas print A4 untuk meeting ruang 2"
                className={inputCls}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>

            <div className="mt-3 flex justify-end gap-2.5 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm shadow-amber-200 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan & Buat Voucher'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
