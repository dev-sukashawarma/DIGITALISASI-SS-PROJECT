import { uraiBearer, hashKunci, hashCocok } from '../kunci'
import { ipKlien, ipDiizinkan } from '../ip'
import { adalahDomain, type Domain } from '../domain'

type Header = { get(n: string): string | null }

export type HasilAutentikasi =
  | { ok: true; kunciId: string; prefix: string; scope: Domain[]; ip: string | null }
  | { ok: false; status: 401 | 403; alasan: string; kunciId: string | null; prefix: string | null; ip: string | null }

/** Satu-satunya gerbang /api/hermes/*. Galat DB dilempar (500), tak pernah dianggap lolos. */
export async function autentikasi(headers: Header, svc: any): Promise<HasilAutentikasi> {
  const ip = ipKlien(headers)
  const b = uraiBearer(headers.get('authorization'))
  if (!b) return { ok: false, status: 401, alasan: 'header Authorization tidak valid', kunciId: null, prefix: null, ip }

  const { data, error } = await svc
    .from('hermes_api_key')
    .select('id, hash_kunci, scope, ip_diizinkan, aktif')
    .eq('prefix', b.prefix)
    .maybeSingle()
  if (error) throw new Error(`hermes_api_key: ${error.message}`)

  if (!data || !hashCocok(hashKunci(b.kunci), String(data.hash_kunci))) {
    return { ok: false, status: 401, alasan: 'kunci tidak dikenal', kunciId: null, prefix: b.prefix, ip }
  }
  if (!data.aktif) return { ok: false, status: 401, alasan: 'kunci dicabut', kunciId: data.id, prefix: b.prefix, ip }
  if (!ipDiizinkan(ip, data.ip_diizinkan ?? [])) {
    return { ok: false, status: 403, alasan: `IP tidak diizinkan: ${ip ?? '(tak diketahui)'}`, kunciId: data.id, prefix: b.prefix, ip }
  }
  const scope = ((data.scope ?? []) as string[]).filter(adalahDomain)
  return { ok: true, kunciId: data.id, prefix: b.prefix, scope, ip }
}

/** Log tak boleh menggagalkan jawaban — galat hanya dicetak. */
export async function catatLog(
  svc: any,
  e: { kunciId: string | null; prefix: string | null; alat: string | null; status: 'ok' | 'galat' | 'ditolak'; alasan?: string | null; ip: string | null; durasiMs: number },
): Promise<void> {
  const { error } = await svc.from('hermes_api_log').insert({
    kunci_id: e.kunciId,
    prefix: e.prefix,
    alat: e.alat,
    status: e.status,
    alasan: e.alasan ? String(e.alasan).slice(0, 500) : null,
    ip: e.ip,
    durasi_ms: Math.round(e.durasiMs),
  })
  if (error) console.error('[hermes] gagal menulis log:', error.message)
}
