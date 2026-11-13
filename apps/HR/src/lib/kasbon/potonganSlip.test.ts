import { describe, it, expect } from 'vitest'
import { cekPotonganKasbonSlip, potonganKasbonSlip } from './potonganSlip'

describe('potonganKasbonSlip', () => {
  it('memakai deduction_kasbon bila terisi', () => {
    expect(potonganKasbonSlip({ deduction_kasbon: 150000, deduction_note: 'Kasbon: Rp 999.000' })).toBe(150000)
  })
  it('jatuh ke catatan potongan bila deduction_kasbon kosong', () => {
    expect(potonganKasbonSlip({ deduction_kasbon: 0, deduction_note: 'Kasbon: Rp 250.000' })).toBe(250000)
    expect(potonganKasbonSlip({ deduction_kasbon: null, deduction_note: 'BPJS Rp 50.000' })).toBe(0)
  })
})

describe('cekPotonganKasbonSlip', () => {
  it('menolak potongan tanpa kasbon yang sudah dicairkan', () => {
    const pesan = cekPotonganKasbonSlip(300000, 0, 'Budi')
    expect(pesan).toContain('Budi')
    expect(pesan).toContain('Rp 300.000')
    expect(pesan).toContain('dicairkan finance')
  })
  it('menolak potongan melebihi sisa kasbon aktif', () => {
    expect(cekPotonganKasbonSlip(300000, 200000, 'Budi')).toContain('Rp 200.000')
  })
  it('lolos bila tidak melebihi sisa', () => {
    expect(cekPotonganKasbonSlip(200000, 200000, 'Budi')).toBeNull()
    expect(cekPotonganKasbonSlip(0, 0, 'Budi')).toBeNull()
  })
})
