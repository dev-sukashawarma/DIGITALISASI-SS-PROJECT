import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/lib/server/telegram', () => ({
  kirimPesanTelegram: vi.fn().mockResolvedValue(undefined),
  kirimAksiChatTelegram: vi.fn().mockResolvedValue(undefined),
  supabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/server/aiRouter', () => ({
  tanyaAiRouter: vi.fn().mockImplementation(async function* () {
    yield 'Laporan Omzet Hari Ini: Rp 15.000.000 dari 150 order.'
  }),
}))

vi.mock('@/lib/server/telemetriNyata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/telemetriNyata')>()
  return {
    ...actual,
    ambilTelemetriNyata: vi.fn().mockResolvedValue({
      tanggalWIB: '2026-10-19',
      omzetTotal: 15000000,
      totalOrder: 150,
      aov: 100000,
      totalOutletAktif: 28,
      outletsAktifTransaksi: [
        { id: '1', nama: 'SUKA SHAWARMA CIMANGGU', type: 'internal', omzet: 5000000, orderCount: 50 },
        { id: '2', nama: 'SUKA SHAWARMA BNR', type: 'internal', omzet: 4000000, orderCount: 40 },
      ],
      outletsNolTransaksi: [
        { id: '3', nama: 'SUKA SHAWARMA JAKAL', type: 'mitra', omzet: 0, orderCount: 0 },
      ],
      outlets: [
        { id: '1', nama: 'SUKA SHAWARMA CIMANGGU', type: 'internal', omzet: 5000000, orderCount: 50 },
      ],
      topMenu: [],
      bahanBaku: [],
    }),
  }
})

import { kirimPesanTelegram, kirimAksiChatTelegram, supabaseAdmin } from '@/lib/server/telegram'

function buatRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://agents.sukashawarma.com/api/telegram/ceo/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/telegram/ceo/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TELEGRAM_CEO_WEBHOOK_SECRET
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
    process.env.TELEGRAM_CEO_WEBHOOK_SECRET = 'secret-ceo-123'
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
        from: { id: 987654, username: 'boss_ss' },
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
      'ceo'
    )
  })

  it('merespons /help dengan panduan eksekutif bot ceo', async () => {
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
      expect.stringContaining('Panduan Komando Eksekutif J.A.R.V.I.S.'),
      'https://agents.sukashawarma.com',
      'ceo'
    )
  })

  it('merespons /help dengan daftar trigger dinamis dari database katalog', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { judul: 'Rekapitulasi Penjualan Kemarin', jadwal_atau_trigger: '04:00 WIB' },
                { judul: 'Eskalasi Void Kritis', jadwal_atau_trigger: 'Real-Time' },
              ],
            }),
          }),
        }),
      }),
    })
    vi.mocked(supabaseAdmin).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof supabaseAdmin>)

    const req = buatRequest({
      update_id: 20,
      message: {
        message_id: 110,
        from: { id: 987654 },
        chat: { id: 987654, type: 'private' },
        text: '/help',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '987654',
      expect.stringContaining('1. *Rekapitulasi Penjualan Kemarin* _(04:00 WIB)_'),
      'https://agents.sukashawarma.com',
      'ceo'
    )
  })

  it('merespons /new dengan konfirmasi reset percakapan', async () => {
    const req = buatRequest({
      update_id: 3,
      message: {
        message_id: 12,
        from: { id: 987654 },
        chat: { id: 987654, type: 'private' },
        text: '/new',
      },
    })

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '987654',
      expect.stringContaining('Sesi Percakapan Baru Dimulai'),
      'https://agents.sukashawarma.com',
      'ceo'
    )
  })

  it('menangani /start dengan kode undangan mandiri inv_...', async () => {
    vi.mocked(supabaseAdmin).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { ok: true, bot_nama: 'Bot CEO' },
        error: null,
      }),
    } as any)

    const req = buatRequest({
      update_id: 4,
      message: {
        message_id: 13,
        from: { id: 987654, first_name: 'Owner' },
        chat: { id: 987654, type: 'private' },
        text: '/start inv_abc123',
      },
    })

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.linked).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '987654',
      expect.stringContaining('Aktivasi Berhasil!'),
      'https://agents.sukashawarma.com',
      'ceo'
    )
  })

  it('menolak pengguna yang tidak memiliki wewenang eksekutif', async () => {
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: table === 'bot_telegram_links'
            ? { staff_id: 'staf-crew', outlet_staff: { role: 'crew', status: 'active' } }
            : null,
          error: null,
        }),
      })),
    } as any)

    const req = buatRequest({
      update_id: 5,
      message: {
        message_id: 14,
        from: { id: 555555 },
        chat: { id: 555555, type: 'private' },
        text: 'Berapa omzet hari ini?',
      },
    })

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '555555',
      expect.stringContaining('belum terhubung atau tidak memiliki wewenang eksekutif'),
      undefined,
      'ceo'
    )
  })

  it('merespons instruksi omzet dari staf owner terdaftar dengan telemetri nyata', async () => {
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: table === 'bot_telegram_links'
            ? {
                staff_id: 'staf-owner-1',
                outlet_staff: { id: 'staf-owner-1', name: 'Pak Boss', role: 'owner', status: 'active' },
              }
            : null,
          error: null,
        }),
      })),
    } as any)

    const req = buatRequest({
      update_id: 6,
      message: {
        message_id: 15,
        from: { id: 111111, first_name: 'Boss' },
        chat: { id: 111111, type: 'private' },
        text: '/omzet',
      },
    })

    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(kirimAksiChatTelegram).toHaveBeenCalledWith('111111', 'typing', 'ceo')
    expect(kirimPesanTelegram).toHaveBeenCalledWith(
      '111111',
      expect.stringContaining('15.000.000'),
      undefined,
      'ceo'
    )
  })
})
