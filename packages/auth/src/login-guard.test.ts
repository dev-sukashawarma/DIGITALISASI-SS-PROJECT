import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetAuthRateLimitMemoryForTests,
  checkAuthRateLimit,
  extractClientIp,
  isTrustedAuthOrigin,
  recordAuthAttempt,
  resolveLoginCandidates,
} from './login-guard'

describe('login-guard security controls', () => {
  beforeEach(() => {
    __resetAuthRateLimitMemoryForTests()
  })

  it('extracts valid client IP and rejects malformed header payloads', () => {
    const valid = new Headers({ 'x-forwarded-for': '203.0.113.42, 10.0.0.1' })
    expect(extractClientIp(valid)).toBe('203.0.113.42')

    const spoofedInvalid = new Headers({ 'x-forwarded-for': 'DROP TABLE users;--' })
    expect(extractClientIp(spoofedInvalid)).toBe('unknown')
  })

  it('enforces same-origin / sukashawarma.com origin validation against CSRF', () => {
    expect(isTrustedAuthOrigin('https://app.sukashawarma.com', 'https://app.sukashawarma.com')).toBe(true)
    expect(isTrustedAuthOrigin('https://pos.sukashawarma.com', 'https://app.sukashawarma.com')).toBe(true)
    expect(isTrustedAuthOrigin('http://localhost:3010', 'http://localhost:3010')).toBe(true)
    expect(isTrustedAuthOrigin('https://evil-sukashawarma.com', 'https://app.sukashawarma.com')).toBe(false)
    expect(isTrustedAuthOrigin('https://attacker.example', 'https://app.sukashawarma.com')).toBe(false)
  })

  it('locks identifier after 8 failed login attempts within 10 minutes and resets on success', async () => {
    const now = 1_700_000_000_000
    for (let i = 0; i < 7; i++) {
      await recordAuthAttempt('198.51.100.10', 'admindev@gmail.com', false, null, now + i * 1000)
    }
    const seventh = await checkAuthRateLimit('198.51.100.10', 'admindev@gmail.com', null, now + 8000)
    expect(seventh.allowed).toBe(true)

    await recordAuthAttempt('198.51.100.10', 'admindev@gmail.com', false, null, now + 9000)
    const eighth = await checkAuthRateLimit('198.51.100.10', 'admindev@gmail.com', null, now + 10_000)
    expect(eighth.allowed).toBe(false)
    expect(eighth.retryAfterSec).toBeGreaterThanOrEqual(60)

    // Window expires after 10 minutes + 1s
    const afterExpiry = await checkAuthRateLimit('198.51.100.10', 'admindev@gmail.com', null, now + 11 * 60_000)
    expect(afterExpiry.allowed).toBe(true)
  })

  it('resolves email and username login candidates deterministically', async () => {
    const emailCandidates = await resolveLoginCandidates('  AdminDev@Gmail.com ', null)
    expect(emailCandidates).toEqual(['admindev@gmail.com'])

    const userCandidates = await resolveLoginCandidates('kasir_sudirman', null)
    expect(userCandidates).toEqual(['kasir_sudirman@ss.com', 'kasir_sudirman@outlet.local'])
  })
})
