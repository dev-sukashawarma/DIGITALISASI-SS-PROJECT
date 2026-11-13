/**
 * Apakah staf boleh ditugaskan ke outlet ini. Outlet berstatus Persiapan
 * (`status = 'pending'`, is_active = false) TETAP boleh: AM, leader, dan crew
 * outlet baru didaftarkan sebelum Go-Live. Menyaring dengan `is_active` saja
 * membuat menyimpan profil AM diam-diam memutus penugasannya ke outlet Persiapan.
 */
export function bisaDitugaskan(o: { is_active?: boolean | null; status?: string | null }): boolean {
  if (o.status) return o.status !== 'inactive'
  return o.is_active !== false
}
