// Keputusan gerbang murni (tanpa I/O) — dipakai ambilSesi (chat) & ambilSesiKantor (papan kantor).
import { profilUntukPeran } from '@/lib/peran'

export type DasarGerbang = {
  userId: string | null
  boleh: boolean
  galatRpc: boolean
  status: string | null
  role: string | null
}
export type GerbangHasil = { ok: true } | { ok: false; status: 401 | 403 }

export function putuskanGerbang(d: DasarGerbang, butuhProfil: boolean): GerbangHasil {
  if (!d.userId) return { ok: false, status: 401 }
  if (d.galatRpc || !d.boleh || d.status !== 'active') return { ok: false, status: 403 }
  if (butuhProfil && !profilUntukPeran(d.role)) return { ok: false, status: 403 }
  return { ok: true }
}
