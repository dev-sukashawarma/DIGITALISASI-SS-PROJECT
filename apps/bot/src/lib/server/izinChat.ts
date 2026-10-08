// Boleh chat dengan sebuah bot = role mengizinkan profilnya DAN kunci profil itu tersedia di server
// (spec kantor bot §10). Server-only: memakai kunciProfil (HERMES_*).
import { adalahProfil, profilBolehUntukPeran, type Profil } from '@/lib/peran'
import { kunciProfil } from '@/lib/hermes'

export function bolehChat(
  role: string | null | undefined,
  profil: Profil | null,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!profil) return false
  return profilBolehUntukPeran(role).includes(profil) && !!kunciProfil(profil, env)
}

// Pemeriksaan permintaan chat (route /api/chat): profil wajib dikenal, boleh untuk pemanggil, dan
// percakapan lama hanya boleh dilanjutkan dengan profil yang sama.
export function periksaProfilChat(
  diminta: unknown,
  role: string | null | undefined,
  profilPercakapan: Profil | null,
  env: Record<string, string | undefined> = process.env,
): { ok: true; profil: Profil } | { ok: false; status: 400 | 403 | 409 } {
  if (!adalahProfil(diminta)) return { ok: false, status: 400 }
  if (!bolehChat(role, diminta, env)) return { ok: false, status: 403 }
  if (profilPercakapan && profilPercakapan !== diminta) return { ok: false, status: 409 }
  return { ok: true, profil: diminta }
}

export type AlasanTanpaChat = 'tanpa_profil' | 'peran' | 'belum_tersambung'

// Alasan bot tidak bisa diajak chat — dibedakan agar panel tidak menyalahkan akun bila
// penyebabnya kunci profil belum dipasang di server.
export function alasanTanpaChat(
  role: string | null | undefined,
  profil: Profil | null,
  env: Record<string, string | undefined> = process.env,
): AlasanTanpaChat | null {
  if (!profil) return 'tanpa_profil'
  if (!profilBolehUntukPeran(role).includes(profil)) return 'peran'
  if (!kunciProfil(profil, env)) return 'belum_tersambung'
  return null
}
