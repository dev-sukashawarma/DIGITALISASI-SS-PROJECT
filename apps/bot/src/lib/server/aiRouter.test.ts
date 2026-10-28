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
    expect(kandidatModel9Router('ceo')).toEqual(['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'cx/gpt-6-sol', 'ag/gemini-3.8-flash', 'MANAGER_SS'])
    expect(kandidatModel9Router('manager')).toEqual(['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'ag/gemini-3.8-flash', 'MANAGER_SS'])
    expect(kandidatModel9Router('gudang')).toEqual(['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'ag/gemini-3.8-flash', 'STOKIS_SS'])
    expect(kandidatModel9Router('stokis')).toEqual(['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'ag/gemini-3.8-flash', 'STOKIS_SS'])
    expect(kandidatModel9Router('marcom')).toEqual(['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'ag/gemini-3.8-flash', 'ANALYTIC-SOSMED-COMBO'])
    expect(kandidatModel9Router('hrd')).toEqual(['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'cx/gpt-6-sol', 'ag/gemini-3.8-flash'])
    expect(kandidatModel9Router('finance')).toEqual(['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'cx/gpt-6-sol', 'ag/gemini-3.8-flash', 'MANAGER_SS'])
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

  it('menyertakan rekapitulasi waste kemarin dan hari ini per cabang dalam prompt sistem', async () => {
    process.env.AI_BASE_URL = 'http://test-ai:20128/v1'
    process.env.AI_API_KEY = 'test-key'
    process.env.AI_MODEL = 'test-model'

    let requestBody: any = null
    const chunks = ['data: {"choices":[{"delta":{"content":"Siap."}}]}\n\n', 'data: [DONE]\n\n']
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c))
        controller.close()
      },
    })

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init: any) => {
      requestBody = JSON.parse(init?.body as string)
      return { ok: true, status: 200, body: readableStream } as any
    })

    const telemetriDenganWaste = {
      ...mockTelemetri,
      waste: {
        totalLaporan30Hari: 45,
        totalEstKerugianRp: 1800000,
        topBahan: [{ nama: 'Sayur (lettuce)', satuan: 'kg', totalQty: 10, frekuensi: 8, alasanDominan: 'Bonggol', estKerugianRp: 250000 }],
        topOutlet: [{ nama: 'MITRA CIBUBUR', frekuensi: 4, totalQty: 5 }],
        laporanHariIniCount: 2,
        estKerugianHariIniRp: 75000,
        rekapOutletHariIni: [{ outlet: 'MITRA CIBUBUR', totalLaporan: 2, totalQty: 3, estKerugianRp: 75000, items: ['Sayur 3 kg'] }],
        rincianHariIni: [{ id: 'w1', outlet: 'MITRA CIBUBUR', bahan: 'Sayur', qty: 3, satuan: 'kg', reason: 'Basi', status: 'APPROVED', estKerugianRp: 75000 }],
        laporanKemarinCount: 35,
        estKerugianKemarinRp: 1450000,
        rekapOutletKemarin: [{ outlet: 'MITRA CILEUDUG', totalLaporan: 5, totalQty: 8, estKerugianRp: 350000, items: ['Sayur (lettuce) 5 kg'] }],
        rincianKemarin: [{ id: 'w2', outlet: 'MITRA CILEUDUG', bahan: 'Sayur (lettuce)', qty: 5, satuan: 'kg', reason: 'Basi / Expired', status: 'APPROVED', estKerugianRp: 350000 }],
      },
    }

    const iter = tanyaAiRouter({ pesan: 'ada laporan waste kemarin?', profil: 'manager', telemetri: telemetriDenganWaste })
    for await (const _ of iter) {}

    expect(requestBody).not.toBeNull()
    const systemPrompt = requestBody.messages[0].content
    expect(systemPrompt).toContain('Laporan Waste Kemarin: 35 laporan')
    expect(systemPrompt).toContain('MITRA CILEUDUG: 5 laporan')
    expect(systemPrompt).toContain('Sayur (lettuce) 5 kg')
    expect(systemPrompt).toContain('Laporan Waste Live Hari Ini: 2 laporan')
    expect(systemPrompt).toContain('MITRA CIBUBUR: 2 laporan')
  })

  it('menyertakan rekapitulasi waste 7 hari terakhir dalam prompt sistem', async () => {
    process.env.AI_BASE_URL = 'http://test-ai:20128/v1'
    process.env.AI_API_KEY = 'test-key'
    process.env.AI_MODEL = 'test-model'

    let requestBody: any = null
    const chunks = ['data: {"choices":[{"delta":{"content":"Siap Sir."}}]}\n\n', 'data: [DONE]\n\n']
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c))
        controller.close()
      },
    })

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init: any) => {
      requestBody = JSON.parse(init?.body as string)
      return { ok: true, status: 200, body: readableStream } as any
    })

    const telemetriDenganWaste7Hari = {
      ...mockTelemetri,
      waste: {
        totalLaporan30Hari: 120,
        totalEstKerugianRp: 4500000,
        topBahan: [{ nama: 'Sayur', satuan: 'kg', totalQty: 30, frekuensi: 20, alasanDominan: 'Basi', estKerugianRp: 500000 }],
        topOutlet: [{ nama: 'JAGAKARSA', frekuensi: 15, totalQty: 25 }],
        laporanHariIniCount: 0,
        laporanKemarinCount: 5,
        laporan7HariCount: 42,
        estKerugian7HariRp: 1250000,
        topBahan7Hari: [{ nama: 'Sayur (lettuce)', satuan: 'kg', totalQty: 18, frekuensi: 12, alasanDominan: 'Basi', estKerugianRp: 450000 }],
        topOutlet7Hari: [{ nama: 'SUKA SHAWARMA JAGAKARSA', frekuensi: 8, totalQty: 10, estKerugianRp: 250000 }],
        rekapOutlet7Hari: [{ outlet: 'SUKA SHAWARMA JAGAKARSA', totalLaporan: 8, totalQty: 10, estKerugianRp: 250000, items: ['Sayur'] }],
      },
    }

    const iter = tanyaAiRouter({ pesan: 'waste tertinggi 7 hari kebelakang', profil: 'ceo', telemetri: telemetriDenganWaste7Hari })
    for await (const _ of iter) {}

    expect(requestBody).not.toBeNull()
    const systemPrompt = requestBody.messages[0].content
    expect(systemPrompt).toContain('DATA REKAPITULASI LOSS & WASTE 7 HARI TERAKHIR')
    expect(systemPrompt).toContain('Total Laporan Waste 7 Hari: 42 laporan')
    expect(systemPrompt).toContain('SUKA SHAWARMA JAGAKARSA')
  })
})
