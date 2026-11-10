import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockAmbilSesi = vi.fn()
vi.mock('@/lib/server/sesi', () => ({
  ambilSesi: () => mockAmbilSesi(),
}))

vi.mock('@/lib/server/voiceConfig', () => ({
  ambilKonfigurasiVoiceServer: vi.fn().mockResolvedValue({
    aiBaseUrl: 'http://mock-9router/v1',
    aiApiKey: 'sk-mock',
  }),
}))

import { POST } from './route'

function buatSseResponse(teksDelta: string) {
  const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: teksDelta } }] })}\n\ndata: [DONE]\n\n`
  return new Response(sse, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('POST /api/voice/stt', () => {
  const fetchAsli = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = fetchAsli
  })

  it('menolak akses tanpa sesi login (401)', async () => {
    mockAmbilSesi.mockResolvedValue({ ok: false, status: 401 })
    const req = new Request('http://localhost/api/voice/stt', {
      method: 'POST',
      body: JSON.stringify({ audioBase64: 'A'.repeat(200), format: 'wav' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('melanjutkan ke model fallback jika model pertama mengembalikan teks kosong tanpa penanda [HENING]', async () => {
    mockAmbilSesi.mockResolvedValue({ ok: true, sesi: { userId: 'u1', nama: 'Bos', role: 'owner' } })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(buatSseResponse(''))
      .mockResolvedValueOnce(buatSseResponse('Berapa omzet kemarin?'))
    globalThis.fetch = fetchMock as any

    const req = new Request('http://localhost/api/voice/stt', {
      method: 'POST',
      body: JSON.stringify({ audioBase64: 'A'.repeat(200), format: 'wav' }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.teks).toBe('Berapa omzet kemarin?')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('langsung mengembalikan teks kosong tanpa retry bila model menandai [HENING]', async () => {
    mockAmbilSesi.mockResolvedValue({ ok: true, sesi: { userId: 'u1', nama: 'Bos', role: 'owner' } })
    const fetchMock = vi.fn().mockResolvedValueOnce(buatSseResponse('[HENING]'))
    globalThis.fetch = fetchMock as any

    const req = new Request('http://localhost/api/voice/stt', {
      method: 'POST',
      body: JSON.stringify({ audioBase64: 'A'.repeat(200), format: 'wav' }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.teks).toBe('')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
