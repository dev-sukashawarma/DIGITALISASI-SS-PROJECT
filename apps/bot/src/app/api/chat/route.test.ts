import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest'

const ambil = vi.fn()
vi.mock('@/lib/server/sesi', () => ({ ambilSesi: () => ambil() }))
vi.mock('@/lib/server/telemetriNyata', () => ({
  ambilTelemetriNyata: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'

function createMockSupabase() {
  return {
    from: () => {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        gte: () => Promise.resolve({ count: 0, data: [], error: null }),
        order: () => builder,
        limit: () => Promise.resolve({ data: [] }),
        single: () => Promise.resolve({ data: { id: 'pc-1', hermes_session_id: 'ses-1', profil: 'manager' }, error: null }),
        insert: () => builder,
        update: () => builder,
      }
      return builder
    },
  }
}

const sesiDengan = (role = 'developer') => ({
  ok: true,
  sesi: {
    supabase: createMockSupabase(),
    userId: 'user-123',
    nama: 'Bos',
    role,
  },
})

describe('POST /api/chat', () => {
  const envLama = { ...process.env }

  beforeEach(() => {
    ambil.mockReset()
    process.env.HERMES_KEYS = JSON.stringify({
      ceo: 'k-ceo',
      manager: 'k-manager',
      review: 'k-review',
    })
  })

  afterAll(() => {
    process.env = { ...envLama }
  })

  it('401 jika sesi tidak valid', async () => {
    ambil.mockResolvedValue({ ok: false, status: 401 })
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ pesan: 'Halo' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.galat).toContain('Silakan login dulu.')
  })

  it('400 jika pesan kosong atau melebihi batas', async () => {
    ambil.mockResolvedValue(sesiDengan('developer'))
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ pesan: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('403 jika role tidak berhak chat dengan profil yang diminta', async () => {
    ambil.mockResolvedValue(sesiDengan('crew'))
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ pesan: 'Cek omzet', profil: 'ceo' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('200 streaming jika developer berhak chat dengan manager', async () => {
    ambil.mockResolvedValue(sesiDengan('developer'))
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ pesan: 'Halo bot', profil: 'manager' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
  })
})
