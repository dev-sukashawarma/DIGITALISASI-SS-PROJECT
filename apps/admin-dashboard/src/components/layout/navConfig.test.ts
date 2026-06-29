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
