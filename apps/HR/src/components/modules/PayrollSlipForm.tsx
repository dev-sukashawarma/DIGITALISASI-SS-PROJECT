'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'
import { formatRupiah } from '@/lib/format'
import type { PayrollRecord } from '@/lib/types'
import { getPayrollBreakdown, buildPayrollNotes, LATE_FEE_PER_MINUTE } from '@/lib/payrollBreakdown'
import { Clock, DollarSign, Wallet, ShieldAlert, Sparkles, Phone, Navigation } from 'lucide-react'

interface PayrollSlipFormProps {
  record: PayrollRecord
  onSubmit: (values: {
    id: string
    basic_salary: number
    allowance_position: number
    allowance_presence: number
    bonus: number
    bonus_note: string | null
    deductions: number
    deduction_note: string | null
  }) => void
  submitting?: boolean
  onCancel: () => void
}

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink'
const labelClass = 'mb-1 block text-xs font-bold text-suka-brown'

export function PayrollSlipForm({ record, onSubmit, submitting, onCancel }: PayrollSlipFormProps) {
  const initial = getPayrollBreakdown(record)

  // 1. Take Home Pay Components (Penerimaan)
  const [basicSalary, setBasicSalary] = useState(initial.basicSalary)
  const [overtime, setOvertime] = useState(initial.overtime)
  const [mealAllowance, setMealAllowance] = useState(initial.mealAllowance)
  const [transportAllowance, setTransportAllowance] = useState(initial.transportAllowance)
  const [communicationAllowance, setCommunicationAllowance] = useState(initial.communicationAllowance)
  const [salesBonus, setSalesBonus] = useState(initial.salesBonus)
  const [positionAllowance, setPositionAllowance] = useState(initial.positionAllowance)

  // 2. Deductions Components (Potongan)
  const [cashAdvanceDeduction, setCashAdvanceDeduction] = useState(initial.cashAdvanceDeduction)
  const [lateMinutes, setLateMinutes] = useState(initial.lateMinutes)
  const [otherDeduction, setOtherDeduction] = useState(initial.otherDeduction)
  const [otherDeductionReason, setOtherDeductionReason] = useState('')

  // Calculations
  const lateDeduction = lateMinutes * LATE_FEE_PER_MINUTE

  const totalEarnings =
    Number(basicSalary) +
    Number(overtime) +
    Number(mealAllowance) +
    Number(transportAllowance) +
    Number(communicationAllowance) +
    Number(salesBonus) +
    Number(positionAllowance)

  const totalDeductions = Number(cashAdvanceDeduction) + Number(lateDeduction) + Number(otherDeduction)
  const takeHomePay = Math.max(0, totalEarnings - totalDeductions)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const { bonus_note, deduction_note } = buildPayrollNotes({
      overtime: Number(overtime),
      salesBonus: Number(salesBonus),
      transport: Number(transportAllowance),
      communication: Number(communicationAllowance),
      kasbon: Number(cashAdvanceDeduction),
      lateMinutes: Number(lateMinutes),
      lateDeduction: Number(lateDeduction),
      otherDeduction: Number(otherDeduction),
      customDeductionNote: otherDeductionReason.trim() || undefined,
    })

    onSubmit({
      id: record.id,
      basic_salary: Number(basicSalary),
      allowance_presence: Number(mealAllowance),
      allowance_position:
        Number(positionAllowance) + Number(transportAllowance) + Number(communicationAllowance),
      bonus: Number(overtime) + Number(salesBonus),
      bonus_note,
      deductions: totalDeductions,
      deduction_note,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-3xl border border-suka-gray-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 my-6 max-h-[92vh] overflow-y-auto"
      >
        {/* Form Header */}
        <div className="border-b border-suka-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-suka-brown">
              Rincian Komponen Gaji: {record.outlet_staff?.name}
            </h3>
          </div>
          <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
            Periode: Bulan {record.period_month}/{record.period_year} &bull; Jabatan: {record.outlet_staff?.role?.replace('_', ' ').toUpperCase()} &bull; Outlet: {record.outlet_staff?.outlets?.name || 'Pusat'}
          </p>
        </div>

        {/* Section 1: Komponen Penerimaan (Take Home Pay) */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-800 tracking-wider bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <DollarSign size={14} className="text-emerald-600" />
            <span>1. Komponen Penerimaan (Earnings)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Gaji Pokok / Gapok (Rp)</label>
              <input
                type="number"
                className={inputClass}
                value={basicSalary}
                onChange={(e) => setBasicSalary(Number(e.target.value))}
                min={0}
                required
              />
            </div>

            <div>
              <label className={labelClass}>
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-emerald-600" />
                  <span>Overtime / Lembur (Rp)</span>
                </span>
              </label>
              <input
                type="number"
                className={inputClass}
                value={overtime}
                onChange={(e) => setOvertime(Number(e.target.value))}
                min={0}
              />
            </div>

            <div>
              <label className={labelClass}>Uang Makan / Meal Allowance (Rp)</label>
              <input
                type="number"
                className={inputClass}
                value={mealAllowance}
                onChange={(e) => setMealAllowance(Number(e.target.value))}
                min={0}
              />
            </div>

            <div>
              <label className={labelClass}>
                <span className="flex items-center gap-1">
                  <Navigation size={12} className="text-blue-600" />
                  <span>Uang Transport (Rp)</span>
                </span>
              </label>
              <input
                type="number"
                className={inputClass}
                value={transportAllowance}
                onChange={(e) => setTransportAllowance(Number(e.target.value))}
                min={0}
              />
            </div>

            <div>
              <label className={labelClass}>
                <span className="flex items-center gap-1">
                  <Phone size={12} className="text-purple-600" />
                  <span>Tunjangan Komunikasi / Pulsa (Rp)</span>
                </span>
              </label>
              <input
                type="number"
                className={inputClass}
                value={communicationAllowance}
                onChange={(e) => setCommunicationAllowance(Number(e.target.value))}
                min={0}
              />
            </div>

            <div>
              <label className={labelClass}>
                <span className="flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-500" />
                  <span>Sales Bonus / Bonus Target (Rp)</span>
                </span>
              </label>
              <input
                type="number"
                className={inputClass}
                value={salesBonus}
                onChange={(e) => setSalesBonus(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>

          <div className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs">
            <span className="font-bold text-emerald-900">Subtotal Penerimaan:</span>
            <span className="font-mono font-black text-emerald-700">{formatRupiah(totalEarnings)}</span>
          </div>
        </div>

        {/* Section 2: Komponen Potongan */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-red-800 tracking-wider bg-red-50 px-3 py-1.5 rounded-xl border border-red-200">
            <ShieldAlert size={14} className="text-red-600" />
            <span>2. Komponen Potongan (Deductions)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                <span className="flex items-center gap-1">
                  <Wallet size={12} className="text-red-600" />
                  <span>Potongan Kasbon (Rp)</span>
                </span>
              </label>
              <input
                type="number"
                className={inputClass}
                value={cashAdvanceDeduction}
                onChange={(e) => setCashAdvanceDeduction(Number(e.target.value))}
                min={0}
              />
            </div>

            <div>
              <label className={labelClass}>
                <span className="flex items-center justify-between">
                  <span>Keterlambatan (Absensi)</span>
                  <span className="text-[10px] text-red-600 font-semibold">Rp 1.000 / menit</span>
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className={`${inputClass} w-24 text-center font-mono`}
                  value={lateMinutes}
                  onChange={(e) => setLateMinutes(Number(e.target.value))}
                  min={0}
                  placeholder="0 mnt"
                />
                <span className="text-xs font-bold text-stone-500">Menit =</span>
                <span className="font-mono font-black text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-200 flex-1 text-right">
                  -{formatRupiah(lateDeduction)}
                </span>
              </div>
            </div>

            <div>
              <label className={labelClass}>Potongan Lain / Ganti Rugi (Rp)</label>
              <input
                type="number"
                className={inputClass}
                value={otherDeduction}
                onChange={(e) => setOtherDeduction(Number(e.target.value))}
                min={0}
              />
            </div>

            <div>
              <label className={labelClass}>Keterangan Potongan Lain</label>
              <input
                type="text"
                className={inputClass}
                value={otherDeductionReason}
                onChange={(e) => setOtherDeductionReason(e.target.value)}
                placeholder="Contoh: Ganti rugi inventaris rusak"
              />
            </div>
          </div>

          <div className="flex justify-between items-center p-2.5 rounded-xl bg-red-50/50 border border-red-200 text-xs">
            <span className="font-bold text-red-900">Subtotal Potongan:</span>
            <span className="font-mono font-black text-red-600">-{formatRupiah(totalDeductions)}</span>
          </div>
        </div>

        {/* Section 3: Take Home Pay Summary Banner */}
        <div className="p-4 rounded-2xl bg-[#FDF9F3] border-2 border-suka-orange/40 flex justify-between items-center shadow-xs">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-suka-gray-500 block">
              Gaji Bersih Diterima Staf
            </span>
            <span className="text-base font-black text-suka-brown">TOTAL TAKE HOME PAY (THP)</span>
          </div>
          <span className="text-xl font-black text-suka-orange font-mono">
            {formatRupiah(takeHomePay)}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-suka-gray-100">
          <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl font-bold">
            Batal
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-xl font-bold bg-suka-orange hover:bg-suka-orange/90 text-white px-6 shadow-md"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Rincian Slip'}
          </Button>
        </div>
      </form>
    </div>
  )
}
