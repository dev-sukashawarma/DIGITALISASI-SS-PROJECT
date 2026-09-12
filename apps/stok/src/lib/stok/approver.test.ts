import { describe, it, expect } from 'vitest'
import { canCatatTerimaVendor, canSahkanNotaVendor, canLihatNotaVendor } from './approver'

describe('drop-ship: peran', () => {
  it('pengesah = purchasing, kitchen, admin (keputusan owner 2026-09-11)', () => {
    for (const r of ['purchasing', 'kitchen', 'admin']) expect(canSahkanNotaVendor(r)).toBe(true)
    for (const r of ['owner', 'admin_finance', 'crew', 'leader', 'spv', null]) expect(canSahkanNotaVendor(r)).toBe(false)
  })
  it('owner & admin_finance boleh melihat, tidak mengesahkan', () => {
    expect(canLihatNotaVendor('owner')).toBe(true)
    expect(canLihatNotaVendor('admin_finance')).toBe(true)
    expect(canLihatNotaVendor('crew')).toBe(false)
  })
  it('pencatat = siapa pun yang punya outlet sendiri', () => {
    expect(canCatatTerimaVendor('d23e11b3-0000-0000-0000-000000000000')).toBe(true)
    expect(canCatatTerimaVendor(null)).toBe(false)
  })
})
