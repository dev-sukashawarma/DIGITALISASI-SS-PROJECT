import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  app: 'stok',
  title: '⚠️ Stok mencapai batas minimum · SS Empang',
  body: 'Stok Daging Sapi tersisa 5. Segera ajukan pemenuhan stok.',
  url: 'https://stok.sukashawarma.com/stok/permintaan',
}

function request(body: unknown = payload, secret = 'test-stokist-secret') {
  return new Request('http://localhost/api/telegram/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  })
}

function database({
  role = 'kitchen',
  status = 'active',
  linked = true,
  access = true,
  error = false,
}: {
  role?: string
  status?: string
  linked?: boolean
  access?: boolean
  error?: boolean
} = {}) {
  const rpcMock = vi.fn().mockResolvedValue({ error: null })
  vi.mocked(supabaseAdmin).mockReturnValue({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => {
          if (error) return { error: { message: 'db error' }, data: null }
          if (table === 'outlet_staff') return { data: { status, role }, error: null }
          if (table === 'bot_telegram_links') return { data: linked ? { chat_id: '12345678' } : null, error: null }
          if (table === 'bot_telegram_access') return { data: access ? { staff_id: id } : null, error: null }
          return { data: null, error: null }
        },
      }
      return query
    },
    rpc: rpcMock,
  } as unknown as ReturnType<typeof supabaseAdmin>)
  return { rpcMock }
}

describe('POST /api/telegram/send', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('TELEGRAM_STOKIST_SEND_SECRET', 'test-stokist-secret')
    database()
  })

  it('menolak tanpa header Authorization yang sah', async () => {
    const res = await POST(request(payload, 'wrong-secret'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('menolak payload dengan user_id bukan UUID', async () => {
    const res = await POST(request({ ...payload, user_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Payload tidak valid.' })
  })

  it('menolak payload dengan app yang tidak diizinkan', async () => {
    const res = await POST(request({ ...payload, app: 'finance' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Payload tidak valid.' })
  })

  it('menolak jika database error saat lookup', async () => {
    const { rpcMock } = database({ error: true })
    const res = await POST(request())
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Database unavailable' })
    expect(rpcMock).toHaveBeenCalledWith('bot_telegram_alert_delivery_failure', {
      p_app: 'stok',
      p_failure_code: 'recipient_lookup_failed',
    })
  })

  it('mengembalikan not_linked jika staf belum menautkan chat_id', async () => {
    database({ linked: false })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ delivered: false, reason: 'not_linked' })
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('mengembalikan not_linked jika staf tidak memiliki akses bot', async () => {
    database({ access: false })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ delivered: false, reason: 'not_linked' })
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('mengembalikan not_linked jika status staf tidak aktif', async () => {
    database({ status: 'inactive' })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ delivered: false, reason: 'not_linked' })
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('MUTLAK: menolak role leader dengan role_not_eligible dan tidak mengirim Telegram', async () => {
    database({ role: 'leader' })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ delivered: false, reason: 'role_not_eligible' })
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('berhasil mengirim alert Telegram untuk role kitchen yang aktif dan tertaut', async () => {
    database({ role: 'kitchen' })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ delivered: true })
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '12345678',
      `${payload.title}\n\n${payload.body}`,
      payload.url
    )
  })

  it('berhasil mengirim alert Telegram untuk role purchasing yang aktif dan tertaut', async () => {
    database({ role: 'purchasing' })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ delivered: true })
    expect(kirimPesanTelegram).toHaveBeenCalled()
  })

  it('mengembalikan 502 jika Telegram API melempar error dan mencatat alert delivery failure', async () => {
    const { rpcMock } = database({ role: 'kitchen' })
    vi.mocked(kirimPesanTelegram).mockRejectedValueOnce(new Error('Telegram network error'))
    const res = await POST(request())
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ delivered: false, reason: 'telegram_error' })
    expect(rpcMock).toHaveBeenCalledWith('bot_telegram_alert_delivery_failure', {
      p_app: 'stok',
      p_failure_code: 'telegram_api_error',
    })
  })
})
