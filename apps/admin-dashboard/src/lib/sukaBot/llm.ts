import type { DefinisiAlat } from './alat/registry'

export interface PanggilanAlat { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface PesanLLM { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: PanggilanAlat[]; tool_call_id?: string }
export type PanggilLLM = (pesan: PesanLLM[], alat: DefinisiAlat[]) => Promise<{ pesan: PesanLLM; tokenMasuk: number; tokenKeluar: number }>

const BATAS_WAKTU_MS = 60_000

/** Klien endpoint OpenAI-compatible (9Router). Tanpa SDK — tidak menambah dependency. */
export function buatPanggilLLM(
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch
): PanggilLLM {
  const base = env.AI_BASE_URL?.replace(/\/+$/, '')
  const key = env.AI_API_KEY
  const model = env.AI_MODEL
  if (!base || !key || !model) throw new Error('AI_BASE_URL/AI_API_KEY/AI_MODEL belum diisi')

  return async (pesan, alat) => {
    const res = await fetchFn(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: pesan,
        // Wajib eksplisit: 9Router membalas text/event-stream bila ada pesan sistem
        // walau stream tidak diminta (terukur 2026-10-05).
        stream: false,
        temperature: 0.2,
        ...(alat.length > 0 ? { tools: alat, tool_choice: 'auto' } : {}),
      }),
      signal: AbortSignal.timeout(BATAS_WAKTU_MS),
    })
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
    if ((res.headers.get('content-type') ?? '').includes('text/event-stream')) {
      throw new Error('LLM membalas streaming (text/event-stream); periksa pengaturan stream di gateway')
    }
    const json: any = await res.json()
    const m = json?.choices?.[0]?.message
    if (!m) throw new Error('LLM: respons tanpa pesan')
    const keluar: PesanLLM = { role: 'assistant', content: m.content ?? null }
    if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) keluar.tool_calls = m.tool_calls
    return { pesan: keluar, tokenMasuk: Number(json?.usage?.prompt_tokens) || 0, tokenKeluar: Number(json?.usage?.completion_tokens) || 0 }
  }
}
