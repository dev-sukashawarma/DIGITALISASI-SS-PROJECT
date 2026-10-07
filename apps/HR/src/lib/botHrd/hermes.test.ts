import { describe, it, expect, vi } from 'vitest'
import { tanyaHermes } from './hermes'

const dasar = { baseUrl: 'http://10.0.1.1:8643', kunci: 'k', sesiId: 's-1', pesan: 'halo' }

describe('tanyaHermes', () => {
  it('POST chat/completions non-stream dengan bearer & session id, kembalikan isi jawaban', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Halo HRD' } }] }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const jawab = await tanyaHermes({ ...dasar, fetchFn: fetchFn as any })
    expect(jawab).toBe('Halo HRD')
    const [url, init] = fetchFn.mock.calls[0] as any
    expect(url).toBe('http://10.0.1.1:8643/p/hrd/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer k')
    expect(init.headers['X-Hermes-Session-Id']).toBe('s-1')
    expect(JSON.parse(init.body)).toEqual({ model: 'hrd', stream: false, messages: [{ role: 'user', content: 'halo' }] })
  })
  it('HTTP gagal / jawaban kosong → error tanpa membocorkan isi respons', async () => {
    const gagal = vi.fn(async () => new Response('secret detail', { status: 500 }))
    await expect(tanyaHermes({ ...dasar, fetchFn: gagal as any })).rejects.toThrow('Bot HRD sedang tidak tersedia (HTTP 500)')
    const kosong = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }))
    await expect(tanyaHermes({ ...dasar, fetchFn: kosong as any })).rejects.toThrow('Bot HRD tidak memberi jawaban')
  })
})
