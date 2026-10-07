import { describe, it, expect } from 'vitest'
import { resolveMitraPolicy, MITRA_POLICY_SEPTEMBER_2026_CUTOFF } from './mitraPolicy'

describe('resolveMitraPolicy', () => {
  it('harus mendefinisikan konstanta cutoff September 2026', () => {
    expect(MITRA_POLICY_SEPTEMBER_2026_CUTOFF).toBe('2026-09-01')
  })

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

import { calculateMitraBepStatus } from './mitraPolicy'

describe('calculateMitraBepStatus', () => {
  const cibinongId = '550e8400-e29b-41d4-a716-446655440014'

  it('harus menghitung SUDAH BEP jika omzet historis + transfer Agustus melebihi modal investasi', () => {
    const inv = {
      nilai_investasi: 125000000,
      omzet_historis: 115000000,
      transfer_historis: 0,
      isBep: false,
      transfers: []
    }

    const bepInfo = calculateMitraBepStatus(inv, cibinongId, '2026-09-01')
    expect(bepInfo.modalInvestasi).toBe(125000000)
    // 115.000.000 + 15.042.343 = 130.042.343
    expect(bepInfo.profitMitraSebelumnya).toBeGreaterThan(125000000)
    expect(bepInfo.isBep).toBe(true)
  })

  it('harus menghitung BELUM BEP jika total pengembalian kurang dari modal investasi', () => {
    const inv = {
      nilai_investasi: 125000000,
      omzet_historis: 20000000,
      transfer_historis: 10000000,
      isBep: false,
      transfers: [
        { bulan: '2026-08-01', nominal: 5000000 }
      ]
    }

    const bepInfo = calculateMitraBepStatus(inv, 'outlet-lain', '2026-09-01')
    expect(bepInfo.profitMitraSebelumnya).toBe(35000000)
    expect(bepInfo.isBep).toBe(false)
  })

  it('harus menghormati flag override isBep jika diset true', () => {
    const inv = {
      nilai_investasi: 125000000,
      omzet_historis: 0,
      isBep: true,
      transfers: []
    }

    const bepInfo = calculateMitraBepStatus(inv, 'outlet-lain', '2026-09-01', true)
    expect(bepInfo.isBep).toBe(true)
  })
})
