import { adalahDomain, type Domain } from './domain'
import { ipValid, normalisasiIp } from './ip'

const MAKS_IP = 10

export function validasiInputKunci(x: { nama: unknown; scope: unknown; ip: unknown }):
  | { ok: true; nama: string; scope: Domain[]; ip: string[] }
  | { ok: false; pesan: string } {
  const nama = typeof x.nama === 'string' ? x.nama.trim() : ''
  if (nama.length < 3 || nama.length > 60) return { ok: false, pesan: 'Nama 3–60 karakter.' }
  if (!Array.isArray(x.scope) || x.scope.length === 0) return { ok: false, pesan: 'Pilih minimal satu domain.' }
  const scope = [...new Set(x.scope.map(String))]
  if (!scope.every(adalahDomain)) return { ok: false, pesan: 'Domain tidak dikenal.' }
  if (!Array.isArray(x.ip)) return { ok: false, pesan: 'Daftar IP tidak valid.' }
  const ip = [...new Set(x.ip.map((s) => normalisasiIp(String(s))).filter(Boolean))]
  if (ip.length > MAKS_IP) return { ok: false, pesan: `Maksimal ${MAKS_IP} IP.` }
  const salah = ip.find((s) => !ipValid(s))
  if (salah) return { ok: false, pesan: `IP tidak valid: ${salah}` }
  return { ok: true, nama, scope: scope as Domain[], ip }
}
