import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/lib/server/telegram', () => ({
  kirimPesanTelegram: vi.fn().mockResolvedValue(undefined),
  kirimAksiChatTelegram: vi.fn().mockResolvedValue(undefined),
  supabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/server/telemetriNyata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/telemetriNyata')>()
  return {
    ...actual,
    ambilTelemetriNyata: vi.fn().mockResolvedValue({
      tanggalWIB: '2026-10-20',
      omzetTotal: 5000000,
      totalOrder: 50,
      aov: 100000,
      totalOutletAktif: 28,
      outletsAktifTransaksi: [],
      outletsNolTransaksi: [],
      outlets: [],
      topMenu: [],
      bahanBaku: [],
    }),
  }
})

import { kirimPesanTelegram, supabaseAdmin } from '@/lib/server/telegram'

function buatRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://agents.sukashawarma.com/api/telegram/review/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/telegram/review/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET
  })

  it('mengabaikan update yang bukan pesan teks atau tidak memiliki sender', async () => {
    const req = buatRequest({ update_id: 123 })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ignored).toBe(true)
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('menolak request jika webhook secret disetel tetapi header tidak cocok', async () => {
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET = 'secret-review'
    const req = buatRequest({
      update_id: 1,
      message: { message_id: 1, from: { id: 100 }, chat: { id: 100 }, text: '/help' },
    }, { 'x-telegram-bot-api-secret-token': 'wrong-secret' })

    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(kirimPesanTelegram).not.toHaveBeenCalled()
  })

  it('merespons /id dengan User ID dan Chat ID pengguna', async () => {
    const req = buatRequest({
      update_id: 2,
      message: {
        message_id: 2,
        from: { id: 123456, first_name: 'Dewi', username: 'dewi_marcom' },
        chat: { id: 123456, type: 'private' },
        text: '/id',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '123456',
      expect.stringContaining('123456'),
      undefined,
      'review'
    )
  })

  it('merespons /help dengan daftar trigger dan commands ulasan', async () => {
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: async () => ({ data: [] }),
            }),
          }),
        }),
      }),
    } as any)

    const req = buatRequest({
      update_id: 3,
      message: {
        message_id: 3,
        from: { id: 123456, first_name: 'Dewi' },
        chat: { id: 123456, type: 'private' },
        text: '/help',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '123456',
      expect.stringContaining('Panduan Bot SukaReview Suka Shawarma'),
      'https://suka.pantaureview.com',
      'review'
    )
  })

  it('merespons /new dengan konfirmasi reset percakapan', async () => {
    const req = buatRequest({
      update_id: 4,
      message: {
        message_id: 4,
        from: { id: 123456, first_name: 'Dewi' },
        chat: { id: 123456, type: 'private' },
        text: '/new',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '123456',
      expect.stringContaining('Sesi Percakapan Baru Dimulai'),
      'https://suka.pantaureview.com',
      'review'
    )
  })

  it('menolak akses jika pengguna tidak memiliki tautan staf / whitelist', async () => {
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: (_table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
              eq: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const req = buatRequest({
      update_id: 5,
      message: {
        message_id: 5,
        from: { id: 999999, first_name: 'Anonim' },
        chat: { id: 999999, type: 'private' },
        text: 'Berapa rating outlet Dramaga?',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '999999',
      expect.stringContaining('belum memiliki izin akses'),
      undefined,
      'review'
    )
  })
})
