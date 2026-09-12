import { describe, expect, it } from 'vitest'
import { buildSalarySlipWhatsAppMessage } from './pdfSalarySlip'
import { rupiah } from './format'
import type { PayrollRecord } from './types'

describe('pdfSalarySlip — buildSalarySlipWhatsAppMessage', () => {
  it('menghasilkan pesan WhatsApp berformat lengkap dengan 6 komponen gaji', () => {
    const mockSlip: Partial<PayrollRecord> = {
      id: 'abc-12345-6789',
      period_month: 9,
      period_year: 2026,
      basic_salary: 2500000,
      allowance_meal: 300000,
      allowance_transport: 200000,
      allowance_communication: 100000,
      sales_bonus: 450000,
      deduction_kasbon: 200000,
      deduction_bpjs: 50000,
      deduction_note: 'Telat (10 mnt x Rp 1.000): Rp 10.000',
      outlet_staff: {
        id: 'st-1',
        name: 'Budi Santoso',
        role: 'crew',
        outlets: { id: 'out-1', name: 'Outlet Empang' },
      } as any,
    }

    const msg = buildSalarySlipWhatsAppMessage(mockSlip as PayrollRecord)

    expect(msg).toContain('*SLIP GAJI RESMI — SUKA SHAWARMA*')
    expect(msg).toContain('👤 Nama: *Budi Santoso*')
    expect(msg).toContain('📅 Periode: *September 2026*')
    expect(msg).toContain(`• Gaji Pokok: ${rupiah(2500000)}`)
    expect(msg).toContain(`• Uang Makan (Meal): ${rupiah(300000)}`)
    expect(msg).toContain(`• Uang Transport: ${rupiah(200000)}`)
    expect(msg).toContain(`• Tunjangan Komunikasi: ${rupiah(100000)}`)
    expect(msg).toContain(`• Sales Bonus: ${rupiah(450000)}`)
    expect(msg).toContain(`• Potongan Kasbon: -${rupiah(200000)}`)
    expect(msg).toContain(`• Potongan BPJS: -${rupiah(50000)}`)
    expect(msg).toContain(`• Denda Keterlambatan (10 menit @ Rp1.000): -${rupiah(10000)}`)
    expect(msg).toContain(`💰 *TAKE HOME PAY: ${rupiah(3290000)}*`)
  })
})
