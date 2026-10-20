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

const id = '40000000-0000-0000-0000-000000000001'
const payload = {
  user_id: id,
  title: '💸 ALERT: PO JATUH TEMPO',
  body: 'PO #12345 dari PT Berkah Utama telah lewat jatuh tempo 3 hari.',
}

function request(body: unknown = payload, secret = 'test-finance-secret') {
  return new Request('http://localhost/api/telegram/finance/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  })
}

function database(role = 'admin_finance', status = 'active', link = true, error = false) {
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
              ? { chat_id: '887766' }
              : null,
        }),
      }
      return query
    },
  } as unknown as ReturnType<typeof supabaseAdmin>)
  return filters
}

describe('POST /api/telegram/finance/send', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('TELEGRAM_FINANCE_SEND_SECRET', 'test-finance-secret')
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

  it('menolak URL yang tidak valid / phishing', async () => {
    const res = await POST(request({ ...payload, url: 'https://evil.com/phishing' }))
    expect(res.status).toBe(400)
  })

  it.each(['crew', 'kitchen', 'kiosk', 'kasir'])('menolak role non-finance (%s)', async (role) => {
    database(role)
    const res = await POST(request())
    expect(await res.json()).toEqual({ delivered: false, reason: 'not_eligible' })
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it.each([
    ['admin_finance', 'inactive', true],
    ['admin_finance', 'active', false],
    ['owner', 'inactive', true],
    ['owner', 'active', false],
  ])('memerlukan status active dan link telegram terdaftar (%s, %s, %s)', async (role, status, link) => {
    database(role, status, link)
    const res = await POST(request())
    expect(await res.json()).toEqual({ delivered: false, reason: 'not_eligible' })
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('mengirim pesan ke Telegram saat role valid (admin_finance)', async () => {
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ delivered: true })
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '887766',
      `${payload.title}\n\n${payload.body}`,
      undefined,
      'finance'
    )
  })

  it('menerima url khusus "finance"', async () => {
    const res = await POST(request({ ...payload, url: 'finance' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ delivered: true })
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '887766',
      `${payload.title}\n\n${payload.body}`,
      'https://finance.sukashawarma.com/',
      'finance'
    )
  })

  it('mengembalikan 503 jika database error', async () => {
    database('admin_finance', 'active', true, true)
    const res = await POST(request())
    expect(res.status).toBe(503)
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })
})
