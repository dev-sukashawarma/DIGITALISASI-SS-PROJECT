import { describe, it, expect, vi } from 'vitest'
import { verifyAccessToken, resolveUserId } from './jwt'

const SECRET = 'super-secret-jwt-key-for-tests-only'

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlJson(obj: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)))
}

/** Sign HS256 JWT memakai WebCrypto (tanpa jose) untuk test. */
async function makeToken(sub: string, expOffsetSec = 3600): Promise<string> {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const payload = b64urlJson({
    sub,
    role: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expOffsetSec,
  })
  const data = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${b64url(new Uint8Array(sig))}`
}

describe('verifyAccessToken', () => {
  it('mengembalikan sub untuk token valid', async () => {
    const token = await makeToken('user-123')
    expect(await verifyAccessToken(token, SECRET)).toEqual({ sub: 'user-123' })
  })

  it('null untuk signature salah', async () => {
    const token = await makeToken('user-123')
    expect(await verifyAccessToken(token, 'secret-yang-salah')).toBeNull()
  })

  it('null untuk token kedaluwarsa', async () => {
    const token = await makeToken('user-123', -1)
    expect(await verifyAccessToken(token, SECRET)).toBeNull()
  })

  it('null untuk string sampah', async () => {
    expect(await verifyAccessToken('bukan.jwt', SECRET)).toBeNull()
  })

  it('null untuk alg selain HS256 (anti alg-confusion)', async () => {
    const header = b64urlJson({ alg: 'none', typ: 'JWT' })
    const payload = b64urlJson({ sub: 'user-123' })
    expect(await verifyAccessToken(`${header}.${payload}.`, SECRET)).toBeNull()
  })
})

describe('resolveUserId', () => {
  it('menggunakan JWT lokal jika valid tanpa memanggil getUser()', async () => {
    const token = await makeToken('user-fast-path')
    const getUserMock = vi.fn()
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: token } },
        }),
        getUser: getUserMock,
      },
    } as any

    const result = await resolveUserId(mockSupabase, SECRET)
    expect(result).toBe('user-fast-path')
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('fallback ke getUser() jika token kedaluwarsa (>1 jam)', async () => {
    const expiredToken = await makeToken('user-expired', -10)
    const getUserMock = vi.fn().mockResolvedValue({
      data: { user: { id: 'refreshed-user-id' } },
    })
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: expiredToken } },
        }),
        getUser: getUserMock,
      },
    } as any

    const result = await resolveUserId(mockSupabase, SECRET)
    expect(result).toBe('refreshed-user-id')
    expect(getUserMock).toHaveBeenCalledTimes(1)
  })

  it('fallback ke getUser() jika tidak ada secret', async () => {
    const getUserMock = vi.fn().mockResolvedValue({
      data: { user: { id: 'dev-user-id' } },
    })
    const mockSupabase = {
      auth: {
        getUser: getUserMock,
      },
    } as any

    const result = await resolveUserId(mockSupabase, undefined)
    expect(result).toBe('dev-user-id')
    expect(getUserMock).toHaveBeenCalledTimes(1)
  })

  it('return null jika session/token invalid dan getUser gagal', async () => {
    const getUserMock = vi.fn().mockResolvedValue({
      data: { user: null },
    })
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
        }),
        getUser: getUserMock,
      },
    } as any

    const result = await resolveUserId(mockSupabase, SECRET)
    expect(result).toBeNull()
    expect(getUserMock).toHaveBeenCalledTimes(1)
  })
})
