import { describe, it, expect } from 'vitest'
import { accessibleItems, accessibleGroups, NAV_GROUPS } from './navConfig'

describe('accessibleItems for MITRA', () => {
  const items = accessibleItems('MITRA')
  const hrefs = items.map((i) => i.href)

  it('exposes exactly 1 page: /dashboard/mitra', () => {
    expect(hrefs).toEqual(['/dashboard/mitra'])
  })

  it('never exposes owner, HR, or system routes', () => {
    expect(hrefs.some((h) => h.startsWith('/dashboard/owner'))).toBe(false)
    expect(hrefs.some((h) => h.startsWith('/dashboard/hr'))).toBe(false)
    expect(hrefs).not.toContain('/dashboard/system-health')
  })
})

describe('Input Pengeluaran nav item', () => {
  it('ADMIN punya akses Bisnis, OWNER tidak punya akses Pengadaan', () => {
    const admin = accessibleItems('ADMIN').map((i) => i.href)
    const owner = accessibleItems('OWNER').map((i) => i.href)
    // ADMIN sees Bisnis group items
    expect(admin).toContain('/dashboard/owner')
    // OWNER cannot access Pengadaan group items
    expect(owner).not.toContain('/dashboard/pembelian')
  })
})

describe('accessibleGroups (pintu berlapis)', () => {
  it('MITRA hanya melihat 1 pintu (Portal Mitra) berisi 1 item', () => {
    const groups = accessibleGroups('MITRA')
    expect(groups.map((g) => g.title)).toEqual(['Portal Mitra'])
    expect(groups[0].items).toHaveLength(1)
  })
  it('ADMIN melihat 7 pintu', () => {
    expect(accessibleGroups('ADMIN').map((g) => g.title)).toEqual([
      'Bisnis', 'Karyawan', 'Pengadaan', 'Produk & Stok', 'Laporan', 'Sistem', 'Manajemen POS',
    ])
  })
  it('OWNER melihat pintu Bisnis, Laporan, Sistem (tanpa Karyawan/Produk/POS)', () => {
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

describe('nav purchase', () => {
  it('PURCHASE hanya melihat grup Pembelian', () => {
    const groups = NAV_GROUPS.filter(g => g.roles.includes('PURCHASE' as any))
    expect(groups.length).toBe(1)
    expect(groups[0].title).toBe('Pembelian')
    const hrefs = groups[0].items.map(i => i.href)
    expect(hrefs).toContain('/dashboard/pembelian/perlu-dibeli')
    expect(hrefs).toContain('/dashboard/pembelian/permintaan')
  })
  it('PURCHASE tidak melihat grup Bisnis/keuangan', () => {
    const bisnis = NAV_GROUPS.find(g => g.title === 'Bisnis')
    expect(bisnis?.roles.includes('PURCHASE' as any)).toBeFalsy()
  })
})
