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
const payloadChatId = {
  chat_id: '99887766',
  title: '⚠️ ALERT ULASAN BARU (1⭐)',
  body: 'Outlet Dramaga menerima review bintang 1 dari Budi.',
}

function request(body: unknown = payloadChatId, secret = 'test-review-secret') {
  return new Request('http://localhost/api/telegram/review/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/telegram/review/send', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('TELEGRAM_REVIEW_SEND_SECRET', 'test-review-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('menolak jika secret authorization tidak valid', async () => {
    const res = await POST(request(payloadChatId, 'wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('mengirim langsung ke chat_id jika diberikan', async () => {
    vi.mocked(kirimPesanTelegram).mockResolvedValue(undefined)
    const res = await POST(request(payloadChatId))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.delivered).toBe(true)
    expect(json.count).toBe(1)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '99887766',
      expect.stringContaining('Outlet Dramaga'),
      undefined,
      'review'
    )
  })

  it('menolak payload jika title atau body kosong', async () => {
    const res = await POST(request({ chat_id: '99887766', title: '' }))
    expect(res.status).toBe(400)
  })

  it('mengirim via user_id staf jika user_id diberikan', async () => {
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            error: null,
            data:
              table === 'outlet_staff'
                ? { role: 'marcom', status: 'active' }
                : { chat_id: '55443322' },
          }),
        }
        return query
      },
    } as unknown as ReturnType<typeof supabaseAdmin>)
    vi.mocked(kirimPesanTelegram).mockResolvedValue(undefined)

    const res = await POST(request({
      user_id: id,
      title: '⭐ REVIEW BARU',
      body: 'Ulasan baru masuk',
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.delivered).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith('55443322', expect.any(String), undefined, 'review')
  })
})
