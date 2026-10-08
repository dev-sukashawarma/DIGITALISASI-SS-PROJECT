// Keputusan gerbang murni (tanpa I/O): owner/admin/developer (is_owner_or_admin) yang staf aktif.
// Izin chat per bot diputuskan terpisah (lib/server/izinChat.ts).
export type DasarGerbang = {
  userId: string | null
  boleh: boolean
  galatRpc: boolean
  status: string | null
}
export type GerbangHasil = { ok: true } | { ok: false; status: 401 | 403 }

export function putuskanGerbang(d: DasarGerbang): GerbangHasil {
  if (!d.userId) return { ok: false, status: 401 }
  if (d.galatRpc || !d.boleh || d.status !== 'active') return { ok: false, status: 403 }
  return { ok: true }
}
