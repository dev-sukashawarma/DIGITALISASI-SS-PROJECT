import { describe, it, expect } from 'vitest'
import { SignJWT } from 'jose'
import { verifyAccessToken } from './jwt'

const SECRET = 'super-secret-jwt-key-for-tests-only'
const key = new TextEncoder().encode(SECRET)

async function makeToken(sub: string, expiresIn = '1h'): Promise<string> {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key)
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
    const token = await makeToken('user-123', '-1s')
    expect(await verifyAccessToken(token, SECRET)).toBeNull()
  })

  it('null untuk string sampah', async () => {
    expect(await verifyAccessToken('bukan.jwt', SECRET)).toBeNull()
  })
})
