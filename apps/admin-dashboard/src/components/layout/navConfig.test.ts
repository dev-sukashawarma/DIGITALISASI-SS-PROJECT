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
  it('ADMIN punya Input Pengeluaran, OWNER tidak', () => {
    const admin = accessibleItems('ADMIN').map((i) => i.href)
    const owner = accessibleItems('OWNER').map((i) => i.href)
    expect(admin).toContain('/dashboard/expenses/input')
    expect(owner).not.toContain('/dashboard/expenses/input')
  })
})

describe('accessibleGroups (pintu berlapis)', () => {
  it('MITRA hanya melihat 1 pintu (Bisnis) berisi 4 item', () => {
    const groups = accessibleGroups('MITRA')
    expect(groups.map((g) => g.title)).toEqual(['Bisnis'])
    expect(groups[0].items).toHaveLength(4)
  })
  it('ADMIN melihat 6 pintu', () => {
    expect(accessibleGroups('ADMIN').map((g) => g.title)).toEqual([
      'Bisnis', 'Karyawan', 'Produk & Stok', 'Laporan', 'Sistem', 'Manajemen POS',
    ])
  })
  it('OWNER melihat pintu Bisnis, Laporan, Sistem, Manajemen POS (tanpa Karyawan/Produk)', () => {
    const titles = accessibleGroups('OWNER').map((g) => g.title)
    expect(titles).toEqual(['Bisnis', 'Laporan', 'Sistem', 'Manajemen POS'])
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

describe('Kerugian Waste nav item', () => {
  it('OWNER dan ADMIN punya akses, MITRA dan ADMIN_HR tidak', () => {
    expect(accessibleItems('OWNER').map(i => i.href)).toContain('/dashboard/owner/waste')
    expect(accessibleItems('ADMIN').map(i => i.href)).toContain('/dashboard/owner/waste')
    expect(accessibleItems('MITRA').map(i => i.href)).not.toContain('/dashboard/owner/waste')
    expect(accessibleItems('ADMIN_HR').map(i => i.href)).not.toContain('/dashboard/owner/waste')
  })
})

describe('Pengaturan Printer nav item', () => {
  it('ADMIN punya Pengaturan Printer di grup Sistem, OWNER tidak', () => {
    const admin = accessibleItems('ADMIN').map((i) => i.href)
    const owner = accessibleItems('OWNER').map((i) => i.href)
    expect(admin).toContain('/dashboard/printer')
    expect(owner).not.toContain('/dashboard/printer')

    const sistem = accessibleGroups('ADMIN').find((g) => g.title === 'Sistem')
    expect(sistem?.items.map((i) => i.href)).toContain('/dashboard/printer')
  })
})

describe('Rekap Bulanan nav item', () => {
  it('OWNER dan ADMIN punya akses, MITRA dan ADMIN_HR tidak', () => {
    expect(accessibleItems('OWNER').map(i => i.href)).toContain('/dashboard/owner/rekap-bulanan')
    expect(accessibleItems('ADMIN').map(i => i.href)).toContain('/dashboard/owner/rekap-bulanan')
    expect(accessibleItems('MITRA').map(i => i.href)).not.toContain('/dashboard/owner/rekap-bulanan')
    expect(accessibleItems('ADMIN_HR').map(i => i.href)).not.toContain('/dashboard/owner/rekap-bulanan')
  })
})
