import { describe, expect, it } from 'vitest'
import {
  isPosStaffRole,
  isPullableRemoteStatus,
  isValidExternalOrderId,
  mapRemoteStatus,
  secretMatches,
} from './onlineOrderRules'

describe('isPosStaffRole', () => {
  it('menerima role kasir & superuser', () => {
    for (const r of ['leader', 'crew', 'regional_manager', 'developer', 'admin']) expect(isPosStaffRole(r)).toBe(true)
  })
  it('menolak role lain dan kosong', () => {
    for (const r of ['mitra', 'owner', 'kiosk', 'kitchen', 'customer', '', null, undefined]) expect(isPosStaffRole(r)).toBe(false)
  })
})

describe('isPullableRemoteStatus', () => {
  it('hanya status sudah-dibayar', () => {
    expect(isPullableRemoteStatus('paid')).toBe(true)
    expect(isPullableRemoteStatus('done')).toBe(true)
    expect(isPullableRemoteStatus('ready')).toBe(true)
    expect(isPullableRemoteStatus('preparing')).toBe(true)
  })
  it('menolak order belum dibayar / batal', () => {
    for (const s of ['pending', 'expired', 'cancelled', '', null, undefined]) expect(isPullableRemoteStatus(s)).toBe(false)
  })
})

describe('mapRemoteStatus', () => {
  it('memetakan status akhir order-system', () => {
    expect(mapRemoteStatus('done')).toBe('completed')
    expect(mapRemoteStatus('ready')).toBe('completed')
    expect(mapRemoteStatus('cancelled')).toBe('cancelled')
  })
  it('null untuk status yang tidak boleh mengubah POS', () => {
    for (const s of ['paid', 'preparing', 'pending', 'expired', 'completed', null]) expect(mapRemoteStatus(s)).toBeNull()
  })
})

describe('isValidExternalOrderId', () => {
  it('menerima UUID', () => {
    expect(isValidExternalOrderId('700e52bf-4129-4117-9adc-4f92a1675493')).toBe(true)
  })
  it('menolak id ojol, injeksi filter, dan non-string', () => {
    for (const v of ['F-3344230874', '3263580204664832310', 'x,id.eq.1', '', null, 123]) expect(isValidExternalOrderId(v)).toBe(false)
  })
})

describe('secretMatches', () => {
  it('cocok hanya bila identik', () => {
    expect(secretMatches('abc123', 'abc123')).toBe(true)
    expect(secretMatches('abc124', 'abc123')).toBe(false)
    expect(secretMatches('abc', 'abc123')).toBe(false)
  })
  it('selalu gagal bila rahasia server kosong', () => {
    expect(secretMatches('', '')).toBe(false)
    expect(secretMatches('x', undefined)).toBe(false)
    expect(secretMatches(null, 'x')).toBe(false)
  })
})
