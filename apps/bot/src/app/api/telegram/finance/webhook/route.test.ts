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
  return new NextRequest('https://agents.sukashawarma.com/api/telegram/finance/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/telegram/finance/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TELEGRAM_FINANCE_WEBHOOK_SECRET
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
    process.env.TELEGRAM_FINANCE_WEBHOOK_SECRET = 'secret-finance'
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
      update_id: 1,
      message: {
        message_id: 10,
        from: { id: 888777, username: 'user_fin' },
        chat: { id: 888777, type: 'private' },
        text: '/id',
      },
    })

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '888777',
      expect.stringContaining('888777'),
      undefined,
      'finance'
    )
  })

  it('merespons /help dengan panduan operasional bot finance', async () => {
    const req = buatRequest({
      update_id: 2,
      message: {
        message_id: 11,
        from: { id: 888777 },
        chat: { id: 888777, type: 'private' },
        text: '/help',
      },
    })

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '888777',
      expect.stringContaining('Panduan Bot Finance'),
      'https://finance.sukashawarma.com',
      'finance'
    )
  })

  it('menangani /start dengan kode undangan mandiri (inv_xxx)', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { ok: true, bot_nama: 'Bot Finance' },
      error: null,
    })
    ;(supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: mockRpc,
    })

    const req = buatRequest({
      update_id: 3,
      message: {
        message_id: 12,
        from: { id: 888777, first_name: 'Budi' },
        chat: { id: 888777, type: 'private' },
        text: '/start inv_finance_test123',
      },
    })

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.linked).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('bot_telegram_redeem_invite_code', {
      p_code: 'inv_finance_test123',
      p_telegram_user_id: '888777',
      p_nama: 'Budi',
      p_username: '',
    })
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '888777',
      expect.stringContaining('Aktivasi Berhasil'),
      'https://finance.sukashawarma.com',
      'finance'
    )
  })

  it('menolak query jika pengguna tidak terdaftar atau tidak memiliki akses', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    })
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
    ;(supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: mockFrom,
    })

    const req = buatRequest({
      update_id: 4,
      message: {
        message_id: 13,
        from: { id: 999999 },
        chat: { id: 999999, type: 'private' },
        text: '/utang',
      },
    })

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '999999',
      expect.stringContaining('belum terhubung atau belum memiliki izin akses'),
      undefined,
      'finance'
    )
  })
})
