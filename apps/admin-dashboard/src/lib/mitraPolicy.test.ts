import { describe, it, expect } from 'vitest'
import { resolveMitraPolicy, MITRA_POLICY_SEPTEMBER_2026_CUTOFF } from './mitraPolicy'

describe('resolveMitraPolicy', () => {
  it('harus menggunakan skema historis lama jika periode sebelum September 2026', () => {
    // Periode Agustus 2026
    const resBelumBep = resolveMitraPolicy({
      periodFrom: '2026-08-01',
      isBep: false,
      legacyProfitSharingPct: 60,
      legacyManagementFee: 5
    })

    expect(resBelumBep.isNewPolicyActive).toBe(false)
    expect(resBelumBep.profitSharingPct).toBe(60)
    expect(resBelumBep.managementFeePct).toBe(5)
    expect(resBelumBep.isBep).toBe(false)

    // Periode Juli 2026, default legacy
    const resDefaultLegacy = resolveMitraPolicy({
      periodFrom: '2026-07-15',
      isBep: true
    })
    expect(resDefaultLegacy.isNewPolicyActive).toBe(false)
    expect(resDefaultLegacy.profitSharingPct).toBe(50)
    expect(resDefaultLegacy.managementFeePct).toBe(0)
  })

  it('harus memberikan 100% laba mitra dan 3% fee management jika periode >= September 2026 dan BELUM BEP', () => {
    const res = resolveMitraPolicy({
      periodFrom: '2026-09-01',
      isBep: false,
      legacyProfitSharingPct: 50,
      legacyManagementFee: 0
    })

    expect(res.isNewPolicyActive).toBe(true)
    expect(res.profitSharingPct).toBe(100)
    expect(res.managementFeePct).toBe(3)
    expect(res.isBep).toBe(false)
    expect(res.statusLabel).toContain('100% Mitra')
    expect(res.statusLabel).toContain('3% Mgmt Fee')
  })

  it('harus memberikan 50:50 profit sharing dan 0% fee management jika periode >= September 2026 dan SUDAH BEP', () => {
    const res = resolveMitraPolicy({
      periodFrom: '2026-09-01',
      isBep: true,
      legacyProfitSharingPct: 70, // legacy harus diabaikan pada aturan baru
      legacyManagementFee: 3
    })

    expect(res.isNewPolicyActive).toBe(true)
    expect(res.profitSharingPct).toBe(50)
    expect(res.managementFeePct).toBe(0)
    expect(res.isBep).toBe(true)
    expect(res.statusLabel).toContain('50:50')
    expect(res.statusLabel).toContain('Bebas Fee')
  })

  it('harus menangani tanggal ISO timestamp dengan benar', () => {
    const res = resolveMitraPolicy({
      periodFrom: '2026-09-15T00:00:00.000Z',
      isBep: false
    })
    expect(res.isNewPolicyActive).toBe(true)
    expect(res.profitSharingPct).toBe(100)
    expect(res.managementFeePct).toBe(3)
  })

  it('harus fallback ke skema historis jika periodFrom kosong/null', () => {
    const res = resolveMitraPolicy({
      periodFrom: null,
      isBep: false,
      legacyProfitSharingPct: 50
    })
    expect(res.isNewPolicyActive).toBe(false)
    expect(res.profitSharingPct).toBe(50)
  })
})
