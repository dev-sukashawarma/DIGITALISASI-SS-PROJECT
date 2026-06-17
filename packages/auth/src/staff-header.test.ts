import { describe, it, expect } from 'vitest'
import { serializeStaffHeader, parseStaffHeader } from './staff-header'
import type { OutletStaffProfile } from './types'

const staff: OutletStaffProfile = {
  id: 'u1',
  outlet_id: 'o1',
  name: 'Andi Empang',
  role: 'crew',
  status: 'active',
  username: 'andi',
  ref_photo_url: null,
  outlets: { name: 'Outlet Empang' },
}

describe('staff-header', () => {
  it('round-trip serialize → parse', () => {
    expect(parseStaffHeader(serializeStaffHeader(staff))).toEqual(staff)
  })

  it('parse mengembalikan null untuk null/undefined/kosong', () => {
    expect(parseStaffHeader(null)).toBeNull()
    expect(parseStaffHeader(undefined)).toBeNull()
    expect(parseStaffHeader('')).toBeNull()
  })

  it('parse mengembalikan null untuk JSON rusak (anti-spoof sampah)', () => {
    expect(parseStaffHeader('%7Bbukan-json')).toBeNull()
  })

  it('hasil serialize aman sebagai nilai header (tanpa newline)', () => {
    const out = serializeStaffHeader({ ...staff, name: 'Baris\nBaru' })
    expect(out).not.toMatch(/[\r\n]/)
  })
})
