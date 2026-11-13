import { describe, it, expect } from 'vitest'
import { canApproveWaste, canReceivePO, canViewBudgetOutlet, canViewVendorPrices, canViewWasteList, canViewJurnalMutasi } from './navAccess'
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

  it('purchasing melihat daftar waste (read-only), tapi tidak menjadi penyetuju', () => {
    expect(canViewWasteList('purchasing')).toBe(true)
    expect(canApproveWaste('purchasing')).toBe(false)
  })

  it('owner melihat dan bisa approve waste', () => {
    expect(canViewWasteList('owner')).toBe(true)
    expect(canApproveWaste('owner')).toBe(true)
  })

  it('Jurnal & Rekonsiliasi tertutup untuk crew, leader, dan area_manager, terbuka untuk manajemen pusat & HR', () => {
    for (const r of ['crew', 'leader', 'area_manager']) expect(canViewJurnalMutasi(r)).toBe(false)
    for (const r of ['kitchen', 'admin', 'admin_hr', 'hr', 'owner', 'spv', 'regional_manager']) expect(canViewJurnalMutasi(r)).toBe(true)
  })

  it('kitchen melihat semua tab operasional', () => {
    expect(canViewBudgetOutlet('kitchen')).toBe(true)
    expect(canApproveWaste('kitchen')).toBe(true)
    expect(canReceivePO('kitchen')).toBe(true)
    expect(canViewVendorPrices('kitchen')).toBe(true)
  })

  it('role kosong ditolak semua', () => {
    for (const fn of [canApproveWaste, canReceivePO, canViewBudgetOutlet, canViewVendorPrices, canViewWasteList]) {
      expect(fn(undefined)).toBe(false)
      expect(fn(null)).toBe(false)
    }
  })
})
