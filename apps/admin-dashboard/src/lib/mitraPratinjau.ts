/* ── Mode pratinjau dashboard mitra ──────────────────────────────────────────
 *
 * Admin / owner / developer tidak punya profil mitra sendiri. Saat membuka
 * /dashboard/mitra mereka melihat dashboard itu PERSIS seperti salah satu mitra
 * melihatnya. Mitra mana yang sedang dipratinjau disimpan di cookie, bukan di
 * query string, karena layout (yang memasang MitraOutletProvider untuk semua
 * sub-halaman) tidak bisa membaca query string — hanya cookie.
 *
 * layout.tsx dan page.tsx WAJIB memilih profil lewat fungsi yang sama di bawah,
 * dari daftar dengan urutan yang sama; kalau tidak, konteks outlet dan isi
 * halaman bisa menunjuk mitra yang berbeda.
 */

export const COOKIE_PRATINJAU_MITRA = 'pratinjau_mitra'

/** Role yang boleh memakai mode pratinjau (developer lolos lewat requireRole). */
export const ROLE_PRATINJAU_MITRA = ['admin', 'owner']

export function pilihProfilPratinjau<T extends { id: string; user_id?: string | null }>(
  profiles: T[],
  idDiminta?: string | null
): T | undefined {
  if (profiles.length === 0) return undefined
  const cocok = idDiminta ? profiles.find(p => p.id === idDiminta || p.user_id === idDiminta) : undefined
  return cocok ?? profiles[0]
}
