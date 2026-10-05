// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { buatPanggilLLM } from './llm'

describe('buatPanggilLLM', () => {
  it('gagal jelas bila env belum diisi', () => {
    expect(() => buatPanggilLLM({})).toThrow('AI_BASE_URL/AI_API_KEY/AI_MODEL belum diisi')
  })
  it('POST /chat/completions dengan model, tools, suhu rendah; membaca pesan & token', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'halo' } }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    }), { status: 200 }))
    const panggil = buatPanggilLLM({ AI_BASE_URL: 'http://9router:20128/v1/', AI_API_KEY: 'k', AI_MODEL: 'm' }, fetchFn as any)
    const r = await panggil([{ role: 'user', content: 'hai' }], [])
    const [url, init] = fetchFn.mock.calls[0] as any
    expect(url).toBe('http://9router:20128/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer k')
    expect(JSON.parse(init.body)).toMatchObject({ model: 'm', temperature: 0.2, messages: [{ role: 'user', content: 'hai' }] })
    expect(JSON.parse(init.body).tools).toBeUndefined()
    expect(r).toEqual({ pesan: { role: 'assistant', content: 'halo' }, tokenMasuk: 12, tokenKeluar: 3 })
  })
  it('HTTP gagal → error', async () => {
    const fetchFn = vi.fn(async () => new Response('limit', { status: 429 }))
    const panggil = buatPanggilLLM({ AI_BASE_URL: 'http://x/v1', AI_API_KEY: 'k', AI_MODEL: 'm' }, fetchFn as any)
    await expect(panggil([], [])).rejects.toThrow('LLM HTTP 429')
  })
})
