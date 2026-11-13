/**
 * Status aktif outlet di cermin Marcom. Outlet berstatus Persiapan
 * (`status = 'pending'`, is_active = false) dianggap AKTIF di Marcom: biaya
 * promosi opening (sering "Dana RAB") dicatat sebelum Go-Live.
 */
export function aktifDiMarcom(o: { is_active?: unknown; status?: unknown }): boolean {
  if (o.status === 'pending') return true
  return (o.is_active as boolean | undefined) ?? true
}
