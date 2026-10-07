// Klien API server Hermes (OpenAI-compatible). SERVER-ONLY: kunci tak boleh ke browser.
import type { Profil } from './peran'
import { BATAS } from './batas'

export type AlasanGalat = 'konfigurasi' | 'http' | 'timeout' | 'jaringan' | 'kosong'

export class GalatHermes extends Error {
  alasan: AlasanGalat
  constructor(alasan: AlasanGalat, pesan: string) {
    super(pesan)
    this.name = 'GalatHermes'
    this.alasan = alasan
  }
}

export function urlChat(baseUrl: string, profil: Profil): string {
  return `${baseUrl.replace(/\/+$/, '')}/p/${profil}/v1/chat/completions`
}

/**
 * Kunci API server Hermes untuk satu profil. Sumber utama: env tunggal
 * HERMES_KEYS = {"ceo":"…","gudang":"…"} — menambah agen cukup edit env ini di
 * Coolify + restart, tanpa rebuild. Cadangan: HERMES_KEY_<PROFIL>. Tiap profil
 * tetap punya kunci sendiri (bocornya satu kunci tidak membuka profil lain).
 */
export function kunciProfil(profil: Profil, env: Record<string, string | undefined> = process.env): string | null {
  const gabungan = env.HERMES_KEYS
  if (gabungan) {
    try {
      const peta = JSON.parse(gabungan)
      if (peta && typeof peta === 'object' && !Array.isArray(peta)) {
        const k = (peta as Record<string, unknown>)[profil]
        if (typeof k === 'string' && k) return k
      } else {
        console.error('[bot] HERMES_KEYS harus objek JSON {"profil":"kunci"}')
      }
    } catch {
      console.error('[bot] HERMES_KEYS bukan JSON yang valid')
    }
  }
  return env[`HERMES_KEY_${profil.toUpperCase()}`] || null
}

/** Pengurai SSE bertahap: menerima potongan teks apa adanya, mengembalikan delta konten. */
export function buatPengurai() {
  let sisa = ''
  const st = {
    selesai: false,
    masukkan(potongan: string): string[] {
      sisa += potongan.replace(/\r\n/g, '\n')
      const keluar: string[] = []
      let i: number
      while ((i = sisa.indexOf('\n\n')) >= 0) {
        const blok = sisa.slice(0, i)
        sisa = sisa.slice(i + 2)
        const data = blok.split('\n').filter((b) => b.startsWith('data:')).map((b) => b.slice(5).trimStart()).join('\n')
        if (!data) continue
        if (data === '[DONE]') { st.selesai = true; continue }
        try {
          const t = JSON.parse(data)?.choices?.[0]?.delta?.content
          if (typeof t === 'string' && t) keluar.push(t)
        } catch { /* blok bukan JSON — abaikan */ }
      }
      return keluar
    },
  }
  return st
}

export async function* tanyaHermes(o: {
  baseUrl: string; kunci: string; profil: Profil; sesiId: string; pesan: string
  signal?: AbortSignal; fetchFn?: typeof fetch
}): AsyncGenerator<string> {
  const f = o.fetchFn ?? fetch
  const batasWaktu = AbortSignal.timeout(BATAS.timeoutMs)
  const signal = o.signal ? AbortSignal.any([o.signal, batasWaktu]) : batasWaktu
  let res: Response
  try {
    res = await f(urlChat(o.baseUrl, o.profil), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${o.kunci}`,
        'X-Hermes-Session-Id': o.sesiId,
      },
      body: JSON.stringify({ model: o.profil, stream: true, messages: [{ role: 'user', content: o.pesan }] }),
      signal,
    })
  } catch (e) {
    throw new GalatHermes(batasWaktu.aborted ? 'timeout' : 'jaringan', String((e as Error)?.message ?? e))
  }
  if (!res.ok || !res.body) throw new GalatHermes('http', `HTTP ${res.status}`)

  const pengurai = buatPengurai()
  const dekoder = new TextDecoder()
  const pembaca = res.body.getReader()
  let adaTeks = false
  try {
    for (;;) {
      const { value, done } = await pembaca.read()
      if (done) break
      for (const t of pengurai.masukkan(dekoder.decode(value, { stream: true }))) {
        adaTeks = true
        yield t
      }
    }
  } catch (e) {
    throw new GalatHermes(batasWaktu.aborted ? 'timeout' : 'jaringan', String((e as Error)?.message ?? e))
  }
  if (!adaTeks) throw new GalatHermes('kosong', 'Hermes tidak mengirim teks')
}
