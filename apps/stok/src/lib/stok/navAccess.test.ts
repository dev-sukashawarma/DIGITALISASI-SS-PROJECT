import { describe, it, expect } from 'vitest'
import { canApproveWaste, canReceivePO, canViewBudgetOutlet, canViewVendorPrices, canViewWasteList } from './navAccess'
import { canViewPermintaanQueue } from './approver'

describe('navAccess — tab dashboard monitoring', () => {
  it('leader tidak melihat tab approval, plafon, waste approval, maupun penerimaan PO', () => {
    expect(canViewPermintaanQueue('leader')).toBe(false)
    expect(canViewBudgetOutlet('leader')).toBe(false)
    expect(canApproveWaste('leader')).toBe(false)
    expect(canReceivePO('leader')).toBe(false)
  })

  it('leader TIDAK melihat Master Harga Bahan Baku', () => {
    expect(canViewVendorPrices('leader')).toBe(false)
  })

  it('leader melihat daftar waste, tapi tidak menjadi penyetuju', () => {
    expect(canViewWasteList('leader')).toBe(true)
    expect(canApproveWaste('leader')).toBe(false)
  })

  it('kitchen melihat semua tab operasional', () => {
    expect(canViewBudgetOutlet('kitchen')).toBe(true)
    expect(canApproveWaste('kitchen')).toBe(true)
    expect(canReceivePO('kitchen')).toBe(true)
    expect(canViewVendorPrices('kitchen')).toBe(true)
  })

  it('role kosong ditolak semua', () => {
    for (const fn of [canApproveWaste, canReceivePO, canViewBudgetOutlet, canViewVendorPrices]) {
      expect(fn(undefined)).toBe(false)
      expect(fn(null)).toBe(false)
    }
  })
})
