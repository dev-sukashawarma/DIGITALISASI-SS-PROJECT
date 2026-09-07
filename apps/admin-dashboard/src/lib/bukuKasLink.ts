/**
 * Tautan dari rincian laba bersih ke halaman Buku Kas (OPEX), membawa serta
 * periode & outlet yang sedang dilihat.
 *
 * Nama parameternya ditaruh di satu konstanta karena dibaca di dua tempat
 * berbeda: modal yang menyusun tautannya, dan halaman Buku Kas yang membaca
 * URL-nya. Berpisah nama = filternya diam-diam tak terbawa.
 */

export const BUKU_KAS_PATH = '/dashboard/reports/input-pengeluaran'

export const BUKU_KAS_PARAMS = { from: 'from', to: 'to', outlet: 'outlet' } as const

export function bukuKasHref(filter: { from: string; to: string; outletId: string }): string {
  const q = new URLSearchParams()
  if (filter.from) q.set(BUKU_KAS_PARAMS.from, filter.from)
  if (filter.to) q.set(BUKU_KAS_PARAMS.to, filter.to)
  if (filter.outletId) q.set(BUKU_KAS_PARAMS.outlet, filter.outletId)
  const qs = q.toString()
  return qs ? `${BUKU_KAS_PATH}?${qs}` : BUKU_KAS_PATH
}
