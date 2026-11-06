// Aturan murni untuk endpoint pesanan website (order-system / FormOrder_SS).
// Dipisah dari route supaya bisa diuji tanpa Next.js / Supabase.

/** Role staf yang boleh memanggil endpoint sinkron pesanan online dari POS. */
export const POS_STAFF_ROLES: readonly string[] = ['leader', 'crew', 'regional_manager', 'developer', 'admin']

export function isPosStaffRole(role: string | null | undefined): boolean {
  return !!role && POS_STAFF_ROLES.includes(role)
}

/**
 * Status order-system yang berarti pelanggan SUDAH membayar. Hanya order
 * berstatus ini yang boleh ditarik ke POS — order `pending`/`expired` belum
 * dibayar, kalau ikut masuk ia menjadi omzet yang uangnya tidak pernah ada.
 */
const PAID_REMOTE_STATUSES = ['paid', 'preparing', 'ready', 'done']

export function isPullableRemoteStatus(status: string | null | undefined): boolean {
  return !!status && PAID_REMOTE_STATUSES.includes(status)
}

/** Status order-system -> status POS. `null` = tidak ada yang perlu diubah. */
export function mapRemoteStatus(status: string | null | undefined): 'completed' | 'cancelled' | null {
  if (status === 'done' || status === 'ready') return 'completed'
  if (status === 'cancelled') return 'cancelled'
  return null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** id order-system selalu UUID; tolak apa pun selain itu sebelum menyentuh DB. */
export function isValidExternalOrderId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id)
}

/** Perbandingan waktu-konstan; `false` bila salah satu kosong. */
export function secretMatches(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected || provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}
