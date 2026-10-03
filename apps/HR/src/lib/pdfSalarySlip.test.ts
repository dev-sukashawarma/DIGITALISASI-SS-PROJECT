import { describe, it, expect } from 'vitest'
import { generateSalarySlipPdf } from './pdfSalarySlip'
import type { PayrollRecord } from './types'

describe('pdfSalarySlip - Waterfall Format', () => {
  it('generates salary slip PDF in waterfall format and writes preview', async () => {
    const mockSlip: PayrollRecord = {
      id: 'e5a090-test',
      staff_id: 'staff-1',
      period_month: 9,
      period_year: 2026,
      basic_salary: 1307692,
      allowance_position: 0,
      allowance_presence: 0,
      bonus: 0,
      bonus_note: null,
      deductions: 12000,
      deduction_note: 'Denda Telat: Rp 12.000',
      total_salary: 1295692,
      status: 'draft',
      outlet_staff: {
        name: 'Alfin Rifaldi',
        role: 'CREW',
        outlet_id: 'outlet-1',
        phone: '08123456789',
        outlets: { name: 'MITRA PAMULANG' },
        financials: {
          bank_name: 'BCA',
          bank_account_number: '6080837249',
          bank_account_name: 'Alfin Rifaldi',
        },
      },
    }

    const doc = await generateSalarySlipPdf(mockSlip)
    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBe(1)
  })

  it('generates multi-item salary slip PDF within 1 page', async () => {
    const mockMulti: PayrollRecord = {
      id: 'multi01-test',
      staff_id: 'staff-2',
      period_month: 9,
      period_year: 2026,
      basic_salary: 2200000,
      allowance_meal: 300000,
      allowance_transport: 250000,
      allowance_communication: 150000,
      allowance_position: 500000,
      allowance_presence: 0,
      sales_bonus: 350000,
      bonus: 350000,
      bonus_note: 'Bonus Penjualan: Rp 350.000',
      deductions: 420000,
      deduction_kasbon: 200000,
      deduction_bpjs: 70000,
      deduction_note: 'Denda Telat (50m): Rp 50.000',
      total_salary: 3330000,
      status: 'finalized',
      outlet_staff: {
        name: 'Siti Nurhaliza',
        role: 'STORE_MANAGER',
        outlet_id: 'outlet-2',
        phone: '08129876543',
        outlets: { name: 'SS BINTARO' },
        financials: {
          bank_name: 'MANDIRI',
          bank_account_number: '123000987654',
          bank_account_name: 'Siti Nurhaliza',
        },
      },
    }

    const doc = await generateSalarySlipPdf(mockMulti)
    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBe(1)
  })
})

