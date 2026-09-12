import { describe, expect, it } from 'vitest'
import {
  getPayrollBreakdown,
  buildPayrollNotes,
} from './payrollBreakdown'
import type { PayrollRecord } from './types'

describe('payrollBreakdown — getPayrollBreakdown', () => {
  it('menghitung THP dengan 6 komponen gaji revisi secara akurat', () => {
    const mockSlip: Partial<PayrollRecord> = {
      basic_salary: 2000000,
      allowance_meal: 300000,
      allowance_transport: 200000,
      allowance_communication: 100000,
      sales_bonus: 500000,
      allowance_position: 250000,
      deduction_kasbon: 150000,
      deduction_bpjs: 50000,
      deduction_note: 'Telat (30 mnt x Rp 1.000): Rp 30.000',
    }

    const breakdown = getPayrollBreakdown(mockSlip as PayrollRecord)

    expect(breakdown.basicSalary).toBe(2000000)
    expect(breakdown.mealAllowance).toBe(300000)
    expect(breakdown.transportAllowance).toBe(200000)
    expect(breakdown.communicationAllowance).toBe(100000)
    expect(breakdown.salesBonus).toBe(500000)
    expect(breakdown.positionAllowance).toBe(250000)
    expect(breakdown.totalEarnings).toBe(3350000)

    expect(breakdown.cashAdvanceDeduction).toBe(150000)
    expect(breakdown.bpjsDeduction).toBe(50000)
    expect(breakdown.lateMinutes).toBe(30)
    expect(breakdown.lateDeduction).toBe(30000)
    expect(breakdown.totalDeductions).toBe(230000)

    expect(breakdown.takeHomePay).toBe(3120000)
  })

  it('mendukung fallback allowance_presence jika allowance_meal kosong', () => {
    const mockSlip: Partial<PayrollRecord> = {
      basic_salary: 1500000,
      allowance_presence: 250000,
    }

    const breakdown = getPayrollBreakdown(mockSlip as PayrollRecord)
    expect(breakdown.mealAllowance).toBe(250000)
    expect(breakdown.takeHomePay).toBe(1750000)
  })

  it('mem-parsing bonus_note JSON jika kolom baru bernilai 0', () => {
    const mockSlip: Partial<PayrollRecord> = {
      basic_salary: 2000000,
      bonus_note: JSON.stringify({
        overtime: 150000,
        salesBonus: 350000,
        transport: 100000,
        communication: 50000,
      }),
    }

    const breakdown = getPayrollBreakdown(mockSlip as PayrollRecord)
    expect(breakdown.overtime).toBe(150000)
    expect(breakdown.salesBonus).toBe(350000)
    expect(breakdown.transportAllowance).toBe(100000)
    expect(breakdown.communicationAllowance).toBe(50000)
    expect(breakdown.totalEarnings).toBe(2650000)
  })

  it('tidak menghasilkan THP negatif jika potongan melebihi penerimaan', () => {
    const mockSlip: Partial<PayrollRecord> = {
      basic_salary: 500000,
      deduction_kasbon: 1000000,
    }

    const breakdown = getPayrollBreakdown(mockSlip as PayrollRecord)
    expect(breakdown.takeHomePay).toBe(0)
  })
})

describe('payrollBreakdown — buildPayrollNotes', () => {
  it('memformat teks catatan bonus dan potongan dengan rapi', () => {
    const notes = buildPayrollNotes({
      overtime: 100000,
      salesBonus: 200000,
      kasbon: 50000,
      lateMinutes: 15,
    })

    expect(notes.bonus_note).toContain('Lembur: Rp 100.000')
    expect(notes.bonus_note).toContain('Sales Bonus: Rp 200.000')
    expect(notes.deduction_note).toContain('Kasbon: Rp 50.000')
    expect(notes.deduction_note).toContain('Telat (15 mnt x Rp 1.000): Rp 15.000')
  })
})
