'use client'

import { useState } from 'react'
import { FileDown, MessageSquare, Check, X } from 'lucide-react'
import { Button } from '@suka/design-system'
import type { PayrollRecord } from '@/lib/types'
import { formatRupiah, formatBulanIndonesia } from '@/lib/format'
import { generateSalarySlipPDF, buildSalarySlipWhatsAppMessage } from '@/lib/pdfSalarySlip'

interface SalarySlipModalProps {
  slip: PayrollRecord
  onClose: () => void
}

export function SalarySlipModal({ slip, onClose }: SalarySlipModalProps) {
  const [copied, setCopied] = useState(false)

  const staffName = slip.outlet_staff?.name || 'Karyawan'
  const outletName = slip.outlet_staff?.outlets?.name || 'Pusat'
  const periodText = `${formatBulanIndonesia(slip.period_month)} ${slip.period_year}`

  const totalEarnings = slip.basic_salary + slip.allowance_position + slip.allowance_presence + slip.bonus
  const totalDeductions = slip.deductions
  const takeHomePay = totalEarnings - totalDeductions

  const handleDownloadPdf = () => {
    generateSalarySlipPDF(slip)
  }

  const handleSendWhatsApp = () => {
    const rawMessage = buildSalarySlipWhatsAppMessage(slip)
    const phone = slip.outlet_staff?.phone?.replace(/[^0-9]/g, '') || ''
    
    // Format Indonesian number to international format
    let targetPhone = phone
    if (targetPhone.startsWith('0')) {
      targetPhone = '62' + targetPhone.slice(1)
    }

    const url = targetPhone
      ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(rawMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(rawMessage)}`

    window.open(url, '_blank')
  }

  const handleCopyText = () => {
    const text = buildSalarySlipWhatsAppMessage(slip)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl border border-suka-gray-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-suka-gray-100 pb-3">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-suka-orange">
              Dokumen Resmi Slip Gaji
            </span>
            <h3 className="text-lg font-black text-suka-brown mt-0.5">{staffName}</h3>
            <p className="text-xs text-suka-gray-500 font-medium">
              {outletName} &bull; Periode: <strong>{periodText}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-suka-gray-400 hover:bg-stone-100 hover:text-suka-ink transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Paper Preview Simulation */}
        <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-suka-brown/10 space-y-4 font-sans text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-dashed border-stone-300">
            <span className="font-extrabold text-suka-brown text-sm">SUKA SHAWARMA</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                slip.status === 'finalized'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {slip.status === 'finalized' ? 'FINAL / PAID' : 'DRAFT'}
            </span>
          </div>

          {/* Earnings */}
          <div className="space-y-1.5">
            <div className="font-bold text-suka-brown text-[11px] uppercase tracking-wider">
              Penerimaan (Earnings)
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Gaji Pokok</span>
              <span className="font-mono font-semibold">{formatRupiah(slip.basic_salary)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Tunjangan Jabatan</span>
              <span className="font-mono font-semibold">{formatRupiah(slip.allowance_position)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Tunjangan Kehadiran</span>
              <span className="font-mono font-semibold">{formatRupiah(slip.allowance_presence)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Bonus &amp; Insentif</span>
              <span className="font-mono font-bold">+{formatRupiah(slip.bonus)}</span>
            </div>
            {slip.bonus_note && (
              <div className="text-[10px] text-gray-500 italic pl-2">&bull; {slip.bonus_note}</div>
            )}
            <div className="flex justify-between font-bold text-suka-ink pt-1 border-t border-stone-200">
              <span>Total Penerimaan</span>
              <span className="font-mono">{formatRupiah(totalEarnings)}</span>
            </div>
          </div>

          {/* Deductions */}
          <div className="space-y-1.5 pt-2 border-t border-dashed border-stone-300">
            <div className="font-bold text-suka-brown text-[11px] uppercase tracking-wider">
              Potongan (Deductions)
            </div>
            <div className="flex justify-between text-red-600 font-medium">
              <span>Potongan Denda &amp; Kasbon</span>
              <span className="font-mono font-bold">-{formatRupiah(slip.deductions)}</span>
            </div>
            {slip.deduction_note && (
              <div className="text-[10px] text-gray-500 italic pl-2">&bull; {slip.deduction_note}</div>
            )}
            <div className="flex justify-between font-bold text-suka-ink pt-1 border-t border-stone-200">
              <span>Total Potongan</span>
              <span className="font-mono">-{formatRupiah(totalDeductions)}</span>
            </div>
          </div>

          {/* Take Home Pay */}
          <div className="p-3 bg-white rounded-xl border border-suka-orange/30 flex justify-between items-center shadow-2xs">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase block">Gaji Bersih Diterima</span>
              <span className="font-extrabold text-suka-brown text-sm">TAKE HOME PAY</span>
            </div>
            <span className="text-base font-black text-suka-orange font-mono">
              {formatRupiah(takeHomePay)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-suka-gray-100">
          <Button
            type="button"
            onClick={handleDownloadPdf}
            className="bg-suka-brown hover:bg-suka-brown/90 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
          >
            <FileDown size={15} /> Download PDF Resmi (A5)
          </Button>

          <Button
            type="button"
            onClick={handleSendWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
          >
            <MessageSquare size={15} /> Kirim ke WhatsApp
          </Button>
        </div>

        <div className="flex justify-between items-center text-xs text-suka-gray-400">
          <button
            onClick={handleCopyText}
            className="hover:text-suka-brown underline flex items-center gap-1 font-semibold cursor-pointer"
          >
            {copied ? <Check size={12} className="text-emerald-600" /> : null}
            <span>{copied ? 'Teks Tersalin!' : 'Salin Teks Pesan'}</span>
          </button>
          <span>Siap kirim ke staf</span>
        </div>
      </div>
    </div>
  )
}
