import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from './route'
import { kirimPesanTelegram, supabaseAdmin } from '@/lib/server/telegram'

vi.mock('@/lib/server/telegram', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/telegram')>('@/lib/server/telegram')
  return {
    ...actual,
    kirimPesanTelegram: vi.fn(),
    supabaseAdmin: vi.fn(),
  }
})

const id = '10000000-0000-0000-0000-000000000001'
const payload = {
  user_id: id,
  title: '⚡ EXECUTIVE DAILY BRIEFING',
  body: 'Ringkasan performa seluruh cabang Suka Shawarma hari ini.',
}

function request(body: unknown = payload, secret = 'test-ceo-secret') {
  return new Request('http://localhost/api/telegram/ceo/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  })
}

function database(role = 'owner', status = 'active', link = true, error = false) {
  const filters: string[][] = []
  vi.mocked(supabaseAdmin).mockReturnValue({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          filters.push([table, key, value])
          return query
        },
        maybeSingle: async () => ({
          error: error ? { message: 'unavailable' } : null,
          data:
            table === 'outlet_staff'
              ? { role, status }
              : link
              ? { chat_id: '12345678' }
              : null,
        }),
      }
      return query
    },
  } as unknown as ReturnType<typeof supabaseAdmin>)
  return filters
}

describe('POST /api/telegram/ceo/send', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('TELEGRAM_CEO_SEND_SECRET', 'test-ceo-secret')
    database()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('memerlukan secret authorization yang valid', async () => {
    const res = await POST(request(payload, 'wrong-secret'))
    expect(res.status).toBe(401)
    expect(supabaseAdmin).not.toHaveBeenCalled()
  })

  it('menolak payload tidak valid', async () => {
    expect((await POST(request({ ...payload, user_id: 'not-a-uuid' }))).status).toBe(400)
    expect((await POST(request({ ...payload, title: '' }))).status).toBe(400)
    expect((await POST(request({ ...payload, body: 'x'.repeat(1201) }))).status).toBe(400)
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('menolak URL yang tidak berasal dari domain resmi CEO', async () => {
    const res = await POST(request({ ...payload, url: 'https://evil.com/phishing' }))
    expect(res.status).toBe(400)
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('menerima URL resmi agents.sukashawarma.com atau admin.sukashawarma.com', async () => {
    const res = await POST(request({ ...payload, url: 'https://agents.sukashawarma.com' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.delivered).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '12345678',
      expect.stringContaining('EXECUTIVE DAILY BRIEFING'),
      'https://agents.sukashawarma.com/',
      'ceo'
    )
  })

  it('menormalisasi url: "bot" atau "agents" ke agents.sukashawarma.com', async () => {
    const res = await POST(request({ ...payload, url: 'bot' }))
    expect(res.status).toBe(200)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '12345678',
      expect.any(String),
      'https://agents.sukashawarma.com/',
      'ceo'
    )
  })

  it('mengirim pesan ke chat_id Telegram untuk role owner', async () => {
    const res = await POST(request())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.delivered).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '12345678',
      `${payload.title}\n\n${payload.body}`,
      undefined,
      'ceo'
    )
  })

  it('mengirim pesan ke chat_id Telegram untuk role admin', async () => {
    database('admin')
    const res = await POST(request())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.delivered).toBe(true)
  })

  it('mengirim pesan ke chat_id Telegram untuk role developer', async () => {
    database('developer')
    const res = await POST(request())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.delivered).toBe(true)
  })

  it('menolak pengiriman jika role bukan eksekutif (mis. crew)', async () => {
    database('crew')
    const res = await POST(request())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.delivered).toBe(false)
    expect(json.reason).toBe('not_eligible')
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('menolak jika status staf tidak aktif', async () => {
    database('owner', 'inactive')
    const res = await POST(request())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.delivered).toBe(false)
    expect(json.reason).toBe('not_eligible')
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('menolak jika belum ada tautan Telegram', async () => {
    database('owner', 'active', false)
    const res = await POST(request())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.delivered).toBe(false)
    expect(json.reason).toBe('not_eligible')
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('mengembalikan 503 jika database error', async () => {
    database('owner', 'active', true, true)
    const res = await POST(request())
    expect(res.status).toBe(503)
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })
})
