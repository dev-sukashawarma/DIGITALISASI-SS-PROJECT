import { describe, expect, it } from 'vitest'
import { validateKasbonApproval } from './kasbonApprovalValidation'

describe('validateKasbonApproval', () => {
  it('harus valid jika nominal sama persis dan catatan kosong', () => {
    const res = validateKasbonApproval(500000, 500000, '')
    expect(res.isValid).toBe(true)
    expect(res.isAmountDifferent).toBe(false)
    expect(res.error).toBeUndefined()
  })

  it('harus valid jika nominal sama persis dengan catatan opsional', () => {
    const res = validateKasbonApproval(500000, 500000, 'Disetujui penuh')
    expect(res.isValid).toBe(true)
    expect(res.isAmountDifferent).toBe(false)
  })

  it('harus menolak jika nominal bernilai 0 atau negatif', () => {
    const resZero = validateKasbonApproval(500000, 0, '')
    expect(resZero.isValid).toBe(false)
    expect(resZero.error).toContain('lebih dari Rp 0')

    const resNeg = validateKasbonApproval(500000, -100000, 'Alasan coba')
    expect(resNeg.isValid).toBe(false)
    expect(resNeg.error).toContain('lebih dari Rp 0')
  })

  it('harus menolak jika nominal berbeda tetapi alasan kosong atau hanya spasi', () => {
    const resEmpty = validateKasbonApproval(1000000, 500000, '')
    expect(resEmpty.isValid).toBe(false)
    expect(resEmpty.isAmountDifferent).toBe(true)
    expect(resEmpty.error).toContain('Alasan perubahan nominal wajib diisi')

    const resWhitespace = validateKasbonApproval(1000000, 500000, '   ')
    expect(resWhitespace.isValid).toBe(false)
    expect(resWhitespace.isAmountDifferent).toBe(true)
    expect(resWhitespace.error).toContain('Alasan perubahan nominal wajib diisi')
  })

  it('harus menolak jika nominal berbeda tetapi alasan kurang dari 3 karakter', () => {
    const resShort = validateKasbonApproval(1000000, 500000, 'ok')
    expect(resShort.isValid).toBe(false)
    expect(resShort.isAmountDifferent).toBe(true)
    expect(resShort.error).toContain('minimal 3 karakter')
  })

  it('harus valid jika nominal berbeda dan alasan memadai (>= 3 karakter)', () => {
    const resLower = validateKasbonApproval(
      1000000,
      500000,
      'Penyesuaian plafon kasbon bulanan karyawan'
    )
    expect(resLower.isValid).toBe(true)
    expect(resLower.isAmountDifferent).toBe(true)
    expect(resLower.error).toBeUndefined()

    const resHigher = validateKasbonApproval(
      500000,
      750000,
      'Tambahan biaya darurat atas persetujuan manajer'
    )
    expect(resHigher.isValid).toBe(true)
    expect(resHigher.isAmountDifferent).toBe(true)
    expect(resHigher.error).toBeUndefined()
  })
})
