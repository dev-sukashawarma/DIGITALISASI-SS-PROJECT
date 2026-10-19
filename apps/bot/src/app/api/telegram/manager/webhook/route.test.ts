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
      tanggalWIB: '2026-10-19',
      omzetTotal: 5000000,
      totalOrder: 50,
      aov: 100000,
      totalOutletAktif: 28,
      outletsAktifTransaksi: [
        { id: '1', nama: 'SUKA SHAWARMA CIMANGGU', type: 'internal', omzet: 3000000, orderCount: 30 },
        { id: '2', nama: 'SUKA SHAWARMA BNR', type: 'internal', omzet: 2000000, orderCount: 20 },
      ],
      outletsNolTransaksi: [
        { id: '3', nama: 'SUKA SHAWARMA JAKAL', type: 'mitra', omzet: 0, orderCount: 0 },
      ],
      outlets: [],
      topMenu: [],
      bahanBaku: [],
    }),
  }
})

import { kirimPesanTelegram, kirimAksiChatTelegram, supabaseAdmin } from '@/lib/server/telegram'

function buatRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://agents.sukashawarma.com/api/telegram/manager/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/telegram/manager/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TELEGRAM_MANAGER_WEBHOOK_SECRET
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
    process.env.TELEGRAM_MANAGER_WEBHOOK_SECRET = 'secret-123'
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
        from: { id: 987654, username: 'testuser' },
        chat: { id: 987654, type: 'private' },
        text: '/id',
      },
    })

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '987654',
      expect.stringContaining('987654'),
      undefined,
      'manager'
    )
  })

  it('merespons /help dengan panduan operasional bot manager', async () => {
    const req = buatRequest({
      update_id: 2,
      message: {
        message_id: 11,
        from: { id: 987654 },
        chat: { id: 987654, type: 'private' },
        text: '/help',
      },
    })

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '987654',
      expect.stringContaining('Panduan Bot Manager'),
      'https://manager.sukashawarma.com',
      'manager'
    )
  })

  it('merespons /start biasa untuk akun yang belum terhubung dengan instruksi aktivasi', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
    })
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabaseAdmin).mockReturnValue({ from: mockFrom } as any)

    const req = buatRequest({
      update_id: 3,
      message: {
        message_id: 12,
        from: { id: 777111, first_name: 'Budi' },
        chat: { id: 777111, type: 'private' },
        text: '/start',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '777111',
      expect.stringContaining('Akun Telegram Anda belum terhubung'),
      undefined,
      'manager'
    )
  })

  it('merespons /start biasa untuk akun yang SUDAH terhubung dengan sapaan kembali', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { staff_id: 'abc-123', outlet_staff: { name: 'Tri Rizky', role: 'area_manager' } },
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
    })
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabaseAdmin).mockReturnValue({ from: mockFrom } as any)

    const req = buatRequest({
      update_id: 4,
      message: {
        message_id: 13,
        from: { id: 888222, first_name: 'Tri' },
        chat: { id: 888222, type: 'private' },
        text: '/start',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '888222',
      expect.stringContaining('Selamat Datang Kembali, Tri Rizky!'),
      'https://manager.sukashawarma.com',
      'manager'
    )
  })

  it('melakukan penautan otomatis (auto-link) saat menerima /start <token> yang valid', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null })
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { staff_id: 'caf-111', outlet_staff: { name: 'Tri Rizky', role: 'area_manager' } },
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
    })
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

    vi.mocked(supabaseAdmin).mockReturnValue({
      rpc: mockRpc,
      from: mockFrom,
    } as any)

    const req = buatRequest({
      update_id: 5,
      message: {
        message_id: 14,
        from: { id: 123456789, first_name: 'Tri', username: 'tririzky' },
        chat: { id: 123456789, type: 'private' },
        text: '/start secret_token_abc123',
      },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.linked).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('bot_telegram_tautkan', {
      p_token_hash: expect.any(String),
      p_telegram_user_id: '123456789',
      p_chat_id: '123456789',
      p_username: 'tririzky',
      p_first_name: 'Tri',
    })
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '123456789',
      expect.stringContaining('Aktivasi Berhasil!'),
      'https://manager.sukashawarma.com',
      'manager'
    )
  })

  it('memberikan notifikasi penolakan jika token /start kedaluwarsa', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: { ok: false, reason: 'expired' }, error: null })
    vi.mocked(supabaseAdmin).mockReturnValue({ rpc: mockRpc } as any)

    const req = buatRequest({
      update_id: 6,
      message: {
        message_id: 15,
        from: { id: 999333, first_name: 'Budi' },
        chat: { id: 999333, type: 'private' },
        text: '/start expired_token_xyz',
      },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.linked).toBe(false)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '999333',
      expect.stringContaining('Tautan Aktivasi Kedaluwarsa'),
      undefined,
      'manager'
    )
  })

  it('menolak pertanyaan teks bebas jika akun belum terhubung', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
    })
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as any)

    const req = buatRequest({
      update_id: 7,
      message: {
        message_id: 20,
        from: { id: 777111 },
        chat: { id: 777111, type: 'private' },
        text: 'Berapa omzet cabang Jakal hari ini?',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '777111',
      expect.stringContaining('belum terhubung'),
      undefined,
      'manager'
    )
  })

  it('mengirim indikasi typing dan jawaban telemetri untuk pengguna terotorisasi (misal: cek buka outlet)', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { staff_id: 'staf-123', outlet_staff: { id: 'staf-123', name: 'Tri Rizky', role: 'regional_manager', status: 'active' } },
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
    })
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as any)

    const req = buatRequest({
      update_id: 8,
      message: {
        message_id: 25,
        from: { id: 888222, first_name: 'Tri' },
        chat: { id: 888222, type: 'private' },
        text: 'udah buka semua belum outlet?',
      },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(kirimAksiChatTelegram).toHaveBeenCalledWith('888222', 'typing', 'manager')
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '888222',
      expect.stringContaining('STATUS OPERASIONAL CABANG'),
      undefined,
      'manager'
    )
  })
})
