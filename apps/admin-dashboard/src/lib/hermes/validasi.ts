import { DOMAIN, adalahDomain, type Domain } from './domain'
import { ipValid, normalisasiIp } from './ip'

const MAKS_IP = 10

/** Dipakai buat kunci & ubah app: dedup, urut sesuai DOMAIN, tolak nilai asing. */
export function validasiScope(x: unknown): { ok: true; scope: Domain[] } | { ok: false; pesan: string } {
  if (!Array.isArray(x) || x.length === 0) return { ok: false, pesan: 'Pilih minimal satu app.' }
  const unik = [...new Set(x.map(String))]
  if (!unik.every(adalahDomain)) return { ok: false, pesan: 'App tidak dikenal.' }
  return { ok: true, scope: DOMAIN.filter((d) => unik.includes(d)) }
}

export function validasiInputKunci(x: { nama: unknown; scope: unknown; ip: unknown }):
  | { ok: true; nama: string; scope: Domain[]; ip: string[] }
  | { ok: false; pesan: string } {
  const nama = typeof x.nama === 'string' ? x.nama.trim() : ''
  if (nama.length < 3 || nama.length > 60) return { ok: false, pesan: 'Nama 3–60 karakter.' }
  const vs = validasiScope(x.scope)
  if (!vs.ok) return vs
  if (!Array.isArray(x.ip)) return { ok: false, pesan: 'Daftar IP tidak valid.' }
  const ip = [...new Set(x.ip.map((s) => normalisasiIp(String(s))).filter(Boolean))]
  if (ip.length > MAKS_IP) return { ok: false, pesan: `Maksimal ${MAKS_IP} IP.` }
  const salah = ip.find((s) => !ipValid(s))
  if (salah) return { ok: false, pesan: `IP tidak valid: ${salah}` }
  return { ok: true, nama, scope: vs.scope, ip }
}
