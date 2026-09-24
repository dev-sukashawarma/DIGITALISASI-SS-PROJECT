import { describe, it, expect } from 'vitest'
import {
  GATE_COOKIE_MAX_AGE_SEC,
  GATE_FRESH_SEC,
  GATE_PREFETCH_STALE_SEC,
  isGateEntryUsable,
  isPrefetchRequest,
  readGateCookie,
  signGateCookie,
} from './gate-cookie'
import { jakartaDayKey, jakartaDayStartIso } from './jakarta-day'

const SECRET = 'gate-secret-for-tests-only'
const STAFF = { id: 'user-1', role: 'crew', status: 'active', outlet_id: 'outlet-1' }
// 10:00 WIB (03:00 UTC)
const T0 = new Date('2026-09-23T03:00:00.000Z')
const at = (sec: number) => new Date(T0.getTime() + sec * 1000)

describe('signGateCookie / readGateCookie', () => {
  it('round-trip: segar sesaat setelah ditandatangani', async () => {
    const value = await signGateCookie('stok', 'user-1', STAFF, SECRET, T0)
    const res = await readGateCookie(value, { app: 'stok', sub: 'user-1', secret: SECRET, now: at(5) })
    expect(res).toEqual({ data: STAFF, fresh: true, ageSec: 5 })
  })

  it('basi setelah masa segar, tetap terbaca sampai umur cookie', async () => {
    const value = await signGateCookie('stok', 'user-1', STAFF, SECRET, T0)
    const stale = await readGateCookie(value, { app: 'stok', sub: 'user-1', secret: SECRET, now: at(GATE_FRESH_SEC) })
    expect(stale?.fresh).toBe(false)
    const tooOld = await readGateCookie(value, {
      app: 'stok',
      sub: 'user-1',
      secret: SECRET,
      now: at(GATE_COOKIE_MAX_AGE_SEC + 1),
    })
    expect(tooOld).toBeNull()
  })

  it('tidak segar lagi setelah lewat tengah malam WIB', async () => {
    // 23:59 WIB → 00:00:30 WIB (masih < 3 menit)
    const before = new Date('2026-09-23T16:59:00.000Z')
    const after = new Date('2026-09-23T17:00:30.000Z')
    const value = await signGateCookie('stok', 'user-1', STAFF, SECRET, before)
    const res = await readGateCookie(value, { app: 'stok', sub: 'user-1', secret: SECRET, now: after })
    expect(res?.fresh).toBe(false)
  })

  it('ditolak bila sub berbeda (ganti akun)', async () => {
    const value = await signGateCookie('stok', 'user-1', STAFF, SECRET, T0)
    expect(await readGateCookie(value, { app: 'stok', sub: 'user-2', secret: SECRET, now: at(1) })).toBeNull()
  })

  it('ditolak bila app berbeda', async () => {
    const value = await signGateCookie('stok', 'user-1', STAFF, SECRET, T0)
    expect(await readGateCookie(value, { app: 'finance', sub: 'user-1', secret: SECRET, now: at(1) })).toBeNull()
  })

  it('ditolak bila secret berbeda', async () => {
    const value = await signGateCookie('stok', 'user-1', STAFF, SECRET, T0)
    expect(await readGateCookie(value, { app: 'stok', sub: 'user-1', secret: 'secret-lain', now: at(1) })).toBeNull()
  })

  it('ditolak bila payload diubah (mis. role dinaikkan)', async () => {
    const value = await signGateCookie('stok', 'user-1', STAFF, SECRET, T0)
    const [payload, sig] = value.split('.')
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    json.data.role = 'admin'
    const forged = btoa(JSON.stringify(json)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await readGateCookie(`${forged}.${sig}`, { app: 'stok', sub: 'user-1', secret: SECRET, now: at(1) })).toBeNull()
  })

  it('ditolak untuk cookie lama tanpa tanda tangan / sampah', async () => {
    const opts = { app: 'stok', sub: 'user-1', secret: SECRET, now: at(1) }
    expect(await readGateCookie(JSON.stringify(STAFF), opts)).toBeNull()
    expect(await readGateCookie('abc.def', opts)).toBeNull()
    expect(await readGateCookie('', opts)).toBeNull()
    expect(await readGateCookie(undefined, opts)).toBeNull()
  })
})

describe('isGateEntryUsable', () => {
  it('entri segar selalu dipakai', () => {
    expect(isGateEntryUsable({ fresh: true, ageSec: 10 }, false)).toBe(true)
  })
  it('entri basi hanya untuk prefetch dan hanya sampai batasnya', () => {
    expect(isGateEntryUsable({ fresh: false, ageSec: 200 }, false)).toBe(false)
    expect(isGateEntryUsable({ fresh: false, ageSec: 200 }, true)).toBe(true)
    expect(isGateEntryUsable({ fresh: false, ageSec: GATE_PREFETCH_STALE_SEC + 1 }, true)).toBe(false)
  })
  it('tanpa entri → false', () => {
    expect(isGateEntryUsable(null, true)).toBe(false)
  })
})

describe('isPrefetchRequest', () => {
  it('mengenali prefetch router Next dan browser, bukan prerender', () => {
    expect(isPrefetchRequest(new Headers({ 'next-router-prefetch': '1' }))).toBe(true)
    expect(isPrefetchRequest(new Headers({ 'sec-purpose': 'prefetch' }))).toBe(true)
    expect(isPrefetchRequest(new Headers({ purpose: 'prefetch' }))).toBe(true)
    expect(isPrefetchRequest(new Headers({ 'sec-purpose': 'prefetch;prerender' }))).toBe(false)
    expect(isPrefetchRequest(new Headers({}))).toBe(false)
  })
})

describe('jakarta-day', () => {
  it('hari Jakarta berganti pukul 17:00 UTC', () => {
    expect(jakartaDayKey(new Date('2026-09-23T16:59:59.000Z'))).toBe('2026-09-23')
    expect(jakartaDayKey(new Date('2026-09-23T17:00:00.000Z'))).toBe('2026-09-24')
  })
  it('awal hari = 00:00 WIB dalam UTC', () => {
    expect(jakartaDayStartIso(new Date('2026-09-23T03:00:00.000Z'))).toBe('2026-09-22T17:00:00.000Z')
    expect(jakartaDayStartIso(new Date('2026-09-23T18:00:00.000Z'))).toBe('2026-09-23T17:00:00.000Z')
  })
})
