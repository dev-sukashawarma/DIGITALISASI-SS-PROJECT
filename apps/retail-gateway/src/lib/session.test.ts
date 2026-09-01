import { describe, it, expect, beforeAll } from 'vitest'
import { issueSession, verifySession } from './session'

beforeAll(() => {
  process.env.SESSION_SECRET = 'rahasia-uji-panjang-minimal-32-karakter-ok'
})

describe('session', () => {
  it('token yang diterbitkan bisa diverifikasi kembali', async () => {
    const { token } = await issueSession('11111111-1111-1111-1111-111111111111')
    const claims = await verifySession(token)
    expect(claims).toEqual({ customerId: '11111111-1111-1111-1111-111111111111' })
  })

  it('token asal-asalan ditolak', async () => {
    expect(await verifySession('bukan-token')).toBeNull()
  })

  it('token dengan tanda tangan salah ditolak', async () => {
    const { token } = await issueSession('11111111-1111-1111-1111-111111111111')
    const rusak = token.slice(0, -3) + 'aaa'
    expect(await verifySession(rusak)).toBeNull()
  })

  it('masa berlaku 30 hari', async () => {
    const { expiresAt } = await issueSession('11111111-1111-1111-1111-111111111111')
    const selisihHari = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000
    expect(selisihHari).toBeGreaterThan(29.9)
    expect(selisihHari).toBeLessThan(30.1)
  })
})
