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

const id = '30000000-0000-0000-0000-000000000001'
const payload = {
  user_id: id,
  title: '🚨 ALERT: OUTLET TELAT BUKA',
  body: 'Outlet: SS Pajajaran belum buka shift setelah 5 menit.',
}

function request(body: unknown = payload, secret = 'test-manager-secret') {
  return new Request('http://localhost/api/telegram/manager/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  })
}

function database(role = 'area_manager', status = 'active', link = true, error = false) {
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
              ? { chat_id: '998877' }
              : null,
        }),
      }
      return query
    },
  } as unknown as ReturnType<typeof supabaseAdmin>)
  return filters
}

describe('POST /api/telegram/manager/send', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('TELEGRAM_MANAGER_SEND_SECRET', 'test-manager-secret')
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

  it('menolak URL yang tidak berasal dari manager.sukashawarma.com', async () => {
    const res = await POST(request({ ...payload, url: 'https://evil.com/phishing' }))
    expect(res.status).toBe(400)
  })

  it.each(['crew', 'kitchen', 'kiosk', 'kasir'])('menolak role non-manager (%s)', async (role) => {
    database(role)
    const res = await POST(request())
    expect(await res.json()).toEqual({ delivered: false, reason: 'not_eligible' })
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it.each([
    ['area_manager', 'inactive', true],
    ['area_manager', 'active', false],
    ['regional_manager', 'inactive', true],
    ['regional_manager', 'active', false],
  ])('memerlukan status active dan link telegram terdaftar (%s, %s, %s)', async (role, status, link) => {
    database(role, status, link)
    const res = await POST(request())
    expect(await res.json()).toEqual({ delivered: false, reason: 'not_eligible' })
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it.each(['area_manager', 'regional_manager', 'developer'])(
    'berhasil mengirim alert ke role %s',
    async (role) => {
      database(role)
      const res = await POST(request({ ...payload, url: 'https://manager.sukashawarma.com/transactions' }))
      expect(await res.json()).toEqual({ delivered: true })
      expect(kirimPesanTelegram).toHaveBeenCalledWith(
        '998877',
        `${payload.title}\n\n${payload.body}`,
        'https://manager.sukashawarma.com/transactions',
        'manager'
      )
    }
  )

  it('mengembalikan status 503 jika database error', async () => {
    database('area_manager', 'active', true, true)
    const res = await POST(request())
    expect(res.status).toBe(503)
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('mengembalikan status 503 jika Telegram fetch gagal', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(kirimPesanTelegram).mockRejectedValueOnce(new Error('telegram network down'))
    const res = await POST(request())
    expect(res.status).toBe(503)
  })
})
