'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'
import { formatRupiah } from '@/lib/format'
import type { PayrollRecord } from '@/lib/types'

interface PayrollSlipFormProps {
  record: PayrollRecord
  onSubmit: (values: {
    id: string
    basic_salary: number
    allowance_position: number
    allowance_presence: number
    bonus: number
    bonus_note: string
    deductions: number
    deduction_note: string
  }) => void
  submitting?: boolean
  onCancel: () => void
}

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink'
const labelClass = 'mb-1 block text-xs font-bold text-suka-brown'

export function PayrollSlipForm({ record, onSubmit, submitting, onCancel }: PayrollSlipFormProps) {
  const [basicSalary, setBasicSalary] = useState(record.basic_salary)
  const [allowancePosition, setAllowancePosition] = useState(record.allowance_position)
  const [allowancePresence, setAllowancePresence] = useState(record.allowance_presence)
  const [bonus, setBonus] = useState(record.bonus)
  const [bonusNote, setBonusNote] = useState(record.bonus_note || '')
  const [deductions, setDeductions] = useState(record.deductions)
  const [deductionNote, setDeductionNote] = useState(record.deduction_note || '')

  const totalCalculated =
    Number(basicSalary) +
    Number(allowancePosition) +
    Number(allowancePresence) +
    Number(bonus) -
    Number(deductions)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      id: record.id,
      basic_salary: Number(basicSalary),
      allowance_position: Number(allowancePosition),
      allowance_presence: Number(allowancePresence),
      bonus: Number(bonus),
      bonus_note: bonusNote.trim(),
      deductions: Number(deductions),
      deduction_note: deductionNote.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-suka-gray-200 bg-white p-6 shadow-xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-base font-extrabold text-suka-brown">
          Edit Rincian Slip Gaji: {record.outlet_staff?.name}
        </h3>
        <p className="text-xs text-suka-gray-500 font-medium">
          Periode: Bulan {record.period_month}/{record.period_year} &bull; Status: {record.status}
        </p>

        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Gaji Pokok (Rp)</label>
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
              <label className={labelClass}>Tunjangan Jabatan (Rp)</label>
              <input
                type="number"
                className={inputClass}
                value={allowancePosition}
                onChange={(e) => setAllowancePosition(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tunjangan Hadir (Rp)</label>
              <input
                type="number"
                className={inputClass}
                value={allowancePresence}
                onChange={(e) => setAllowancePresence(Number(e.target.value))}
                min={0}
              />
            </div>
            <div>
              <label className={labelClass}>Bonus / Insentif (Rp)</label>
              <input
                type="number"
                className={inputClass}
                value={bonus}
                onChange={(e) => setBonus(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Catatan Bonus</label>
            <input
              type="text"
              className={inputClass}
              value={bonusNote}
              onChange={(e) => setBonusNote(e.target.value)}
              placeholder="Contoh: Bonus Target Omset Ramadan"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Potongan / Kasbon (Rp)</label>
              <input
                type="number"
                className={inputClass}
                value={deductions}
                onChange={(e) => setDeductions(Number(e.target.value))}
                min={0}
              />
            </div>
            <div>
              <label className={labelClass}>Catatan Potongan</label>
              <input
                type="text"
                className={inputClass}
                value={deductionNote}
                onChange={(e) => setDeductionNote(e.target.value)}
                placeholder="Contoh: Cicilan Kasbon Ke-2"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#FDF9F3] border border-suka-orange/30 flex justify-between items-center">
            <span className="text-xs font-bold text-suka-brown">Total Gaji Bersih:</span>
            <span className="text-sm font-black text-suka-orange">{formatRupiah(totalCalculated)}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-suka-gray-100">
          <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl font-bold">
            Batal
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-xl font-bold bg-suka-orange hover:bg-suka-orange/90 text-white"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </form>
    </div>
  )
}
