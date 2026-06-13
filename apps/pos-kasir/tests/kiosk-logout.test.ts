import { describe, it, expect } from 'vitest'
import { resolveLogoutTargets } from '@/lib/kiosk-logout'
import type { KioskAccount } from '@/lib/kiosk-logout'

const OUTLET = 'outlet-A'
const kiosks: KioskAccount[] = [
  { id: 'kiosk-1', outlet_id: OUTLET },
  { id: 'kiosk-2', outlet_id: OUTLET },
]

describe('resolveLogoutTargets', () => {
  it('menolak requester non-kasir', () => {
    const r = resolveLogoutTargets({ role: 'kiosk', outlet_id: OUTLET }, { target: 'all' }, kiosks)
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
  })

  it('menolak kasir tanpa outlet', () => {
    const r = resolveLogoutTargets({ role: 'kasir', outlet_id: null }, { target: 'all' }, kiosks)
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
  })

  it('menolak target kosong', () => {
    const r = resolveLogoutTargets({ role: 'kasir', outlet_id: OUTLET }, { target: '' }, kiosks)
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })

  it('target "all" mengembalikan semua kiosk outlet', () => {
    const r = resolveLogoutTargets({ role: 'kasir', outlet_id: OUTLET }, { target: 'all' }, kiosks)
    expect(r.ok).toBe(true)
    expect(r.targetUserIds.sort()).toEqual(['kiosk-1', 'kiosk-2'])
  })

  it('target id valid di outlet mengembalikan satu id', () => {
    const r = resolveLogoutTargets({ role: 'kasir', outlet_id: OUTLET }, { target: 'kiosk-2' }, kiosks)
    expect(r.ok).toBe(true)
    expect(r.targetUserIds).toEqual(['kiosk-2'])
  })

  it('menolak target id di luar outlet', () => {
    const r = resolveLogoutTargets({ role: 'kasir', outlet_id: OUTLET }, { target: 'kiosk-lain' }, kiosks)
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
  })
})
