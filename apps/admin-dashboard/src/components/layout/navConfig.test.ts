import { describe, it, expect } from 'vitest'
import { accessibleItems, accessibleGroups } from './navConfig'

describe('accessibleItems for MITRA', () => {
  const items = accessibleItems('MITRA')
  const hrefs = items.map((i) => i.href)

  it('exposes exactly the 4 mitra pages (order-independent)', () => {
    expect([...hrefs].sort()).toEqual(
      [
        '/dashboard/owner',
        '/dashboard/owner/targets',
        '/dashboard/owner/profit',
        '/dashboard/owner/expenses',
      ].sort()
    )
  })

  it('never exposes Pesan ke Kasir, HR, or System routes', () => {
    expect(hrefs).not.toContain('/dashboard/owner/messages')
    expect(hrefs.some((h) => h.startsWith('/dashboard/hr'))).toBe(false)
    expect(hrefs).not.toContain('/dashboard/outlets')
    expect(hrefs).not.toContain('/dashboard/system-health')
  })
})

describe('Input Pengeluaran nav item', () => {
  it('OWNER punya Input Pengeluaran, MITRA tidak', () => {
    const owner = accessibleItems('OWNER').map((i) => i.href)
    const mitra = accessibleItems('MITRA').map((i) => i.href)
    expect(owner).toContain('/dashboard/owner/expenses/input')
    expect(mitra).not.toContain('/dashboard/owner/expenses/input')
  })
})

describe('accessibleGroups (pintu berlapis)', () => {
  it('MITRA hanya melihat 1 pintu (Bisnis) berisi 4 item', () => {
    const groups = accessibleGroups('MITRA')
    expect(groups.map((g) => g.title)).toEqual(['Bisnis'])
    expect(groups[0].items).toHaveLength(4)
  })
  it('ADMIN melihat 5 pintu', () => {
    expect(accessibleGroups('ADMIN').map((g) => g.title)).toEqual([
      'Bisnis', 'Karyawan', 'Produk & Stok', 'Laporan', 'Sistem',
    ])
  })
  it('OWNER melihat pintu Bisnis, Laporan, Sistem (tanpa Karyawan/Produk)', () => {
    const titles = accessibleGroups('OWNER').map((g) => g.title)
    expect(titles).toEqual(['Bisnis', 'Laporan', 'Sistem'])
  })
  it('setiap pintu yang tampil punya minimal 1 item', () => {
    for (const role of ['ADMIN', 'OWNER', 'ADMIN_HR', 'MITRA'] as const) {
      for (const g of accessibleGroups(role)) {
        expect(g.items.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('Master Bahan Baku nav item', () => {
  it('is visible to ADMIN', () => {
    const hrefs = accessibleItems('ADMIN').map((i) => i.href)
    expect(hrefs).toContain('/dashboard/bahan-baku')
  })
  it('is hidden from OWNER, ADMIN_HR, and MITRA', () => {
    for (const role of ['OWNER', 'ADMIN_HR', 'MITRA'] as const) {
      const hrefs = accessibleItems(role).map((i) => i.href)
      expect(hrefs).not.toContain('/dashboard/bahan-baku')
    }
  })
})
