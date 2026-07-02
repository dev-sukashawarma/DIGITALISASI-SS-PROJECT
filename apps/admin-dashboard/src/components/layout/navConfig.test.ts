import { describe, it, expect } from 'vitest'
import { accessibleItems } from './navConfig'

describe('accessibleItems for MITRA', () => {
  const items = accessibleItems('MITRA')
  const hrefs = items.map((i) => i.href)

  it('exposes exactly the 4 mitra pages', () => {
    expect(hrefs).toEqual([
      '/dashboard/owner',
      '/dashboard/owner/targets',
      '/dashboard/owner/profit',
      '/dashboard/owner/expenses',
    ])
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
