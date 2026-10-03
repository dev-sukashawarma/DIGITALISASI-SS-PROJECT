'use client'

import { useState } from 'react'
import { FileDown, MessageSquare, Check, X, Clock, Wallet, ShieldAlert, Sparkles, Navigation, Phone, DollarSign, Send, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import type { PayrollRecord } from '@/lib/types'
import { formatRupiah, formatBulanIndonesia } from '@/lib/format'
import { buildSalarySlipWhatsAppMessage } from '@/lib/whatsappSalarySlip'
import { getPayrollBreakdown } from '@/lib/payrollBreakdown'

interface SalarySlipModalProps {
  slip: PayrollRecord
  onClose: () => void
  isKasbonManual?: boolean
}

export function SalarySlipModal({ slip, onClose, isKasbonManual }: SalarySlipModalProps) {
  const [copied, setCopied] = useState(false)
  const [sendingWaha, setSendingWaha] = useState(false)

  const b = getPayrollBreakdown(slip)
  const staffName = slip.outlet_staff?.name || 'Karyawan'
  const roleName = slip.outlet_staff?.role?.replace('_', ' ').toUpperCase() || 'STAFF'
  const outletName = slip.outlet_staff?.outlets?.name || 'Pusat'
  const periodText = `${formatBulanIndonesia(slip.period_month)} ${slip.period_year}`

  const handleDownloadPdf = async () => {
    const { generateSalarySlipPDF } = await import('@/lib/pdfSalarySlip')
    await generateSalarySlipPDF(slip)
  }

  const handleSendWaha = async () => {
    const phone = slip.outlet_staff?.phone
    if (!phone) {
      toast.error('Nomor WhatsApp karyawan belum terdaftar di database')
      return
    }

    setSendingWaha(true)
    try {
      const { sendSingleWahaSalarySlip } = await import('@/app/actions/waha')
      const res = await sendSingleWahaSalarySlip(slip, { sendPdfFile: true })
      if (res.success) {
        toast.success(`Slip gaji & dokumen PDF berhasil dikirim ke WhatsApp ${staffName}!`)
      } else {
        toast.warning(`Gagal kirim via WAHA: ${res.error}. Anda dapat membuka WhatsApp manual.`)
        handleSendWhatsApp()
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghubungi server WAHA')
    } finally {
      setSendingWaha(false)
    }
  }

  const handleSendWhatsApp = () => {
    const rawMessage = buildSalarySlipWhatsAppMessage(slip)
    const phone = slip.outlet_staff?.phone?.replace(/[^0-9]/g, '') || ''
    
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
      <div className="w-full max-w-lg rounded-3xl border border-suka-gray-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 my-6 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-suka-gray-100 pb-3">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-suka-orange">
              Dokumen Resmi Slip Gaji
            </span>
            <h3 className="text-lg font-black text-suka-brown mt-0.5">{staffName}</h3>
            <p className="text-xs text-suka-gray-500 font-medium">
              {roleName} &bull; {outletName} &bull; Periode: <strong>{periodText}</strong>
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
          <div className="flex justify-between items-center pb-3 border-b border-dashed border-stone-300">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Suka Shawarma Logo"
                className="w-8 h-8 rounded-full border border-stone-200 object-contain bg-white shadow-2xs"
              />
              <div>
                <span className="font-extrabold text-suka-brown text-sm block leading-tight">SUKA SHAWARMA</span>
                <span className="text-[10px] text-stone-500 font-medium">Slip Gaji Resmi Karyawan</span>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 border ${
                slip.status === 'finalized'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              {slip.status === 'finalized' ? 'FINAL / RESMI' : 'DRAFT / PREVIEW'}
            </span>
          </div>

          {/* 1. Earnings Breakdown */}
          <div className="space-y-1.5">
            <div className="font-bold text-suka-brown text-[11px] uppercase tracking-wider flex items-center gap-1">
              <DollarSign size={13} className="text-suka-orange" />
              <span>Komponen Penerimaan (Earnings)</span>
            </div>
            
            <div className="flex justify-between text-gray-700">
              <span>Gaji Pokok (Gapok)</span>
              <span className="font-mono font-semibold">{formatRupiah(b.basicSalary)}</span>
            </div>

            {b.overtime > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span className="flex items-center gap-1">
                  <Clock size={11} /> Lembur (Overtime)
                </span>
                <span className="font-mono font-bold">+{formatRupiah(b.overtime)}</span>
              </div>
            )}

            {b.mealAllowance > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Uang Makan (Meal)</span>
                <span className="font-mono font-semibold">{formatRupiah(b.mealAllowance)}</span>
              </div>
            )}

            {b.transportAllowance > 0 && (
              <div className="flex justify-between text-gray-700">
                <span className="flex items-center gap-1">
                  <Navigation size={11} /> Uang Transport
                </span>
                <span className="font-mono font-semibold">{formatRupiah(b.transportAllowance)}</span>
              </div>
            )}

            {b.communicationAllowance > 0 && (
              <div className="flex justify-between text-gray-700">
                <span className="flex items-center gap-1">
                  <Phone size={11} /> Tunjangan Komunikasi
                </span>
                <span className="font-mono font-semibold">{formatRupiah(b.communicationAllowance)}</span>
              </div>
            )}

            {b.salesBonus > 0 && (
              <div className="flex justify-between text-amber-700 font-bold">
                <span className="flex items-center gap-1">
                  <Sparkles size={11} />{' '}
                  {slip.bonus_note?.toLowerCase().includes('reward absensi')
                    ? 'Reward Absensi (Staff Office)'
                    : 'Sales Bonus (Target Omset)'}
                </span>
                <span className="font-mono font-bold">+{formatRupiah(b.salesBonus)}</span>
              </div>
            )}

            {b.positionAllowance > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Tunjangan Jabatan</span>
                <span className="font-mono font-semibold">{formatRupiah(b.positionAllowance)}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-suka-ink pt-1.5 border-t border-stone-200">
              <span>Total Penerimaan</span>
              <span className="font-mono text-emerald-800">{formatRupiah(b.totalEarnings)}</span>
            </div>
          </div>

          {/* 2. Deductions Breakdown */}
          <div className="space-y-1.5 pt-2 border-t border-dashed border-stone-300">
            <div className="font-bold text-suka-brown text-[11px] uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert size={13} className="text-red-600" />
              <span>Komponen Potongan (Deductions)</span>
            </div>

            {b.cashAdvanceDeduction > 0 && (
              <div className="flex justify-between text-red-600 font-medium items-center">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <Wallet size={11} /> 
                  <span>Potongan Kasbon</span>
                  {isKasbonManual ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs">
                      <AlertCircle size={10} className="text-amber-600" />
                      Injeksi Excel / Manual
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded shadow-xs">
                      <CheckCircle2 size={10} className="text-emerald-600" />
                      Kasbon Sistem
                    </span>
                  )}
                </span>
                <span className={`font-mono font-bold ${isKasbonManual ? 'text-amber-800' : ''}`}>-{formatRupiah(b.cashAdvanceDeduction)}</span>
              </div>
            )}

            {b.bpjsDeduction > 0 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span className="flex items-center gap-1">
                  <ShieldAlert size={11} /> Potongan BPJS
                </span>
                <span className="font-mono font-bold">-{formatRupiah(b.bpjsDeduction)}</span>
              </div>
            )}

            {b.lateDeduction > 0 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span className="flex items-center gap-1">
                  <Clock size={11} /> Denda Telat ({b.lateMinutes} menit @ Rp1.000)
                </span>
                <span className="font-mono font-bold">-{formatRupiah(b.lateDeduction)}</span>
              </div>
            )}

            {b.otherDeduction > 0 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span>Potongan Lain / Ganti Rugi</span>
                <span className="font-mono font-bold">-{formatRupiah(b.otherDeduction)}</span>
              </div>
            )}

            {b.totalDeductions === 0 && (
              <div className="flex justify-between text-stone-500 italic">
                <span>Tidak ada potongan</span>
                <span className="font-mono">Rp 0</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-red-700 pt-1.5 border-t border-stone-200">
              <span>Total Potongan</span>
              <span className="font-mono">-{formatRupiah(b.totalDeductions)}</span>
            </div>
          </div>

          {/* 3. Take Home Pay Banner */}
          <div className="p-3.5 bg-white rounded-2xl border-2 border-suka-orange/40 flex justify-between items-center shadow-xs">
            <div>
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-wider block">Gaji Bersih Diterima</span>
              <span className="font-black text-suka-brown text-sm">TOTAL TAKE HOME PAY</span>
            </div>
            <span className="text-lg font-black text-suka-orange font-mono">
              {formatRupiah(b.takeHomePay)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-suka-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={handleDownloadPdf}
              className="bg-suka-brown hover:bg-suka-brown/90 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
            >
              <FileDown size={15} /> Download PDF Resmi (A5)
            </Button>

            <Button
              type="button"
              disabled={sendingWaha}
              onClick={handleSendWaha}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              {sendingWaha ? (
                <>
                  <Spinner size={14} />
                  <span>Mengirim WAHA + PDF...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Kirim via WAHA (+ PDF)</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex justify-between items-center text-xs text-suka-gray-500 pt-0.5">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="hover:text-emerald-700 underline flex items-center gap-1 font-medium cursor-pointer"
              title="Buka web.whatsapp.com / WhatsApp Desktop manual"
            >
              <MessageSquare size={13} />
              <span>Buka WA Manual (wa.me)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="hover:text-suka-brown underline flex items-center gap-1 font-semibold cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : null}
              <span>{copied ? 'Teks Tersalin!' : 'Salin Teks Pesan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
