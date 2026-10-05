export interface Rekap { id: string; tanggal: string; versi: number; teks: string; dibuat_at: string }

async function panggil<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.galat || 'SUKA Bot sedang tidak tersedia')
  return body as T
}

export const ambilRekap = (base: string) => panggil<{ rekap: Rekap }>(`${base}/api/asisten/rekap`)
export const perbaruiRekap = (base: string, tanggal: string) =>
  panggil<{ rekap: Rekap }>(`${base}/api/asisten/rekap`, { method: 'POST', body: JSON.stringify({ tanggal }) })
export interface PesanTersimpan { peran: 'user' | 'assistant'; isi: string; dibuat_at: string; jenis: string | null }
export const ambilPesan = (base: string, percakapanId: string) =>
  panggil<{ pesan: PesanTersimpan[] }>(`${base}/api/asisten/percakapan?id=${encodeURIComponent(percakapanId)}`)
export const kirimPesan = (base: string, pesan: string, percakapanId?: string) =>
  panggil<{ percakapanId: string; jawaban: string }>(`${base}/api/asisten/chat`, { method: 'POST', body: JSON.stringify({ pesan, percakapanId }) })
