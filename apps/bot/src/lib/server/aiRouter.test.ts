import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tanyaAiRouter, kandidatModel9Router } from './aiRouter'
import type { TelemetriHariIni } from './telemetriNyata'

const mockTelemetri: TelemetriHariIni = {
  tanggalWIB: '2026-10-13',
  omzetTotal: 4094000,
  totalOrder: 61,
  aov: 67114,
  outlets: [
    { id: '1', nama: 'SUKA SHAWARMA CIMANGGU', type: 'internal', omzet: 1292000, orderCount: 8 },
  ],
  outletsAktifTransaksi: [
    { id: '1', nama: 'SUKA SHAWARMA CIMANGGU', type: 'internal', omzet: 1292000, orderCount: 8 },
  ],
  outletsNolTransaksi: [],
  topMenu: [
    { nama: 'Original Ayam Jumbo', qty: 23, omzet: 1012000 },
  ],
  kehadiranTotal: 70,
  kehadiranTepatWaktu: 60,
  kehadiranTelat: 10,
  persenOnTime: 86,
  totalOutletAktif: 28,
  bahanBaku: [
    { nama: 'GAS 12 KG', satuan: 'tabung' },
  ],
  stafCutiIzin: [
    {
      nama: 'Muhamad Andrian Hermawan',
      role: 'crew',
      jenis: 'tahunan',
      status: 'pending',
      alasan: 'ada kepentingan di rumah',
    },
  ],
  stafTelat: [
    {
      nama: 'Mohamad Raka',
      outlet: 'MITRA SENTUL',
      telatMenit: 74,
    },
  ],
}

describe('aiRouter', () => {
  const envAsli = process.env

  beforeEach(() => {
    process.env = { ...envAsli }
  })

  afterEach(() => {
    process.env = envAsli
    vi.restoreAllMocks()
  })

  it('memetakan profil Hermes ke model combo 9Router yang sesuai', () => {
    expect(kandidatModel9Router('ceo')).toEqual(['hermes-combo'])
    expect(kandidatModel9Router('manager')).toEqual(['MANAGER_SS', 'hermes-combo'])
    expect(kandidatModel9Router('gudang')).toEqual(['STOKIS_SS', 'hermes-combo'])
    expect(kandidatModel9Router('stokis')).toEqual(['STOKIS_SS', 'hermes-combo'])
    expect(kandidatModel9Router('marcom')).toEqual(['ANALYTIC-SOSMED-COMBO', 'hermes-combo'])
    expect(kandidatModel9Router('hrd')).toEqual(['hermes-combo'])
    expect(kandidatModel9Router('finance')).toEqual(['hermes-combo'])
  })

  it('melempar error jika AI_BASE_URL atau AI_API_KEY kosong', async () => {
    delete process.env.AI_BASE_URL
    delete process.env.AI_API_KEY

    const iter = tanyaAiRouter({ pesan: 'halo', profil: 'ceo', telemetri: null })
    await expect(iter.next()).rejects.toThrow('AI Router belum dikonfigurasi')
  })

  it('mengirim konteks telemetri dan riwayat percakapan ke endpoint chat/completions', async () => {
    process.env.AI_BASE_URL = 'http://test-ai:20128/v1'
    process.env.AI_API_KEY = 'test-key'
    process.env.AI_MODEL = 'test-model'

    let requestBody: any = null

    // Mock response SSE stream
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Salam, "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Sir."}}]}\n\n',
      'data: [DONE]\n\n',
    ]

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      start(controller) {
        for (const c of chunks) {
          controller.enqueue(encoder.encode(c))
        }
        controller.close()
      },
    })

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init: any) => {
      requestBody = JSON.parse(init.body)
      return {
        ok: true,
        status: 200,
        body: readableStream,
      } as any
    })

    const riwayat = [
      { role: 'user' as const, content: 'halo kemarin omzet berapa?' },
      { role: 'assistant' as const, content: 'Kemarin omzet Rp 3.000.000, Sir.' },
    ]

    const hasil: string[] = []
    for await (const chunk of tanyaAiRouter({
      pesan: 'yang ga masuk hari ini siapa?',
      profil: 'ceo',
      telemetri: mockTelemetri,
      riwayat,
    })) {
      hasil.push(chunk)
    }

    expect(hasil.join('')).toBe('Salam, Sir.')

    // Verifikasi request body
    expect(requestBody).not.toBeNull()
    expect(requestBody.model).toBe('test-model')
    expect(requestBody.stream).toBe(true)

    // Cek pesan diteruskan termasuk system, riwayat, dan prompt
    const messages = requestBody.messages
    expect(messages.length).toBe(4) // system, 2 riwayat, 1 user
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('Muhamad Andrian Hermawan')
    expect(messages[0].content).toContain('Mohamad Raka')
    expect(messages[1]).toEqual({ role: 'user', content: 'halo kemarin omzet berapa?' })
    expect(messages[2]).toEqual({ role: 'assistant', content: 'Kemarin omzet Rp 3.000.000, Sir.' })
    expect(messages[3]).toEqual({ role: 'user', content: 'yang ga masuk hari ini siapa?' })
  })

  it('menangani respons non-ok dari AI Router', async () => {
    process.env.AI_BASE_URL = 'http://test-ai:20128/v1'
    process.env.AI_API_KEY = 'test-key'

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      body: null,
    } as any)

    const iter = tanyaAiRouter({ pesan: 'test', profil: 'ceo', telemetri: null })
    await expect(iter.next()).rejects.toThrow('AI Router HTTP 502')
  })
})

