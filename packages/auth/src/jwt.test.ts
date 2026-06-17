import { describe, it, expect } from 'vitest'
import { verifyAccessToken } from './jwt'

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
