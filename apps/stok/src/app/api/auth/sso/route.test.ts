import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setSession = vi.fn()
const setAll = vi.fn()

vi.mock('@suka/auth', () => ({
  createSupabaseServerClient: vi.fn((adapter) => {
    setAll.mockImplementation(adapter.setAll)
    return { auth: { setSession } }
  }),
}))

import { POST } from './route'

function request(body: unknown, origin = 'https://stok.sukashawarma.com') {
  return new NextRequest('https://stok.sukashawarma.com/api/auth/sso', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/sso', () => {
  beforeEach(() => {
    setSession.mockReset()
    setAll.mockReset()
  })

  it('menolak request lintas origin sebelum menyentuh auth', async () => {
    const response = await POST(request({}, 'https://evil.example'))

    expect(response.status).toBe(403)
    expect(setSession).not.toHaveBeenCalled()
  })

  it('menolak payload token yang tidak lengkap', async () => {
    const response = await POST(request({ accessToken: 'pendek' }))

    expect(response.status).toBe(400)
    expect(setSession).not.toHaveBeenCalled()
  })

  it('memvalidasi token dan meneruskan cookie sesi ke response', async () => {
    setSession.mockImplementation(async () => {
      setAll([
        {
          name: 'sb-test-auth-token',
          value: 'cookie-value',
          options: { path: '/' },
        },
      ])
      return {
        data: { session: { access_token: 'access' }, user: { id: 'user-1' } },
        error: null,
      }
    })

    const response = await POST(
      request({
        accessToken: `header.${'a'.repeat(40)}.signature`,
        refreshToken: `refresh-${'b'.repeat(40)}`,
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(setSession).toHaveBeenCalledOnce()
    expect(response.headers.get('set-cookie')).toContain('sb-test-auth-token=cookie-value')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('tidak mengirim cookie ketika Supabase menolak token', async () => {
    setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('invalid token'),
    })

    const response = await POST(
      request({
        accessToken: `header.${'a'.repeat(40)}.signature`,
        refreshToken: `refresh-${'b'.repeat(40)}`,
      })
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
