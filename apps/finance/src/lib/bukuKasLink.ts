/**
 * Tautan ke halaman Buku Kas (OPEX) di aplikasi Finance, membawa serta
 * filter periode & outlet yang sedang dilihat.
 */

export const BUKU_KAS_PATH = '/laporan/buku-kas'

export const BUKU_KAS_PARAMS = { from: 'from', to: 'to', outlet: 'outlet' } as const

export function bukuKasHref(filter: { from: string; to: string; outletId: string }): string {
  const q = new URLSearchParams()
  if (filter.from) q.set(BUKU_KAS_PARAMS.from, filter.from)
  if (filter.to) q.set(BUKU_KAS_PARAMS.to, filter.to)
  if (filter.outletId) q.set(BUKU_KAS_PARAMS.outlet, filter.outletId)
  const qs = q.toString()
  return qs ? `${BUKU_KAS_PATH}?${qs}` : BUKU_KAS_PATH
}
