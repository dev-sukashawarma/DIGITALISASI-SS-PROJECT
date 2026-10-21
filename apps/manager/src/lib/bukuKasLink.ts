export const BUKU_KAS_PATH = '/buku-kas'

export const BUKU_KAS_PARAMS = {
  from: 'from',
  to: 'to',
  outlet: 'outlet',
  outletId: 'outlet_id',
  source: 'sumber',
  category: 'kategori'
} as const

export function bukuKasHref(
  filter: { from: string; to: string; outletId: string }
): string {
  const q = new URLSearchParams()
  if (filter.from) q.set(BUKU_KAS_PARAMS.from, filter.from)
  if (filter.to) q.set(BUKU_KAS_PARAMS.to, filter.to)
  if (filter.outletId) q.set(BUKU_KAS_PARAMS.outletId, filter.outletId)
  const qs = q.toString()
  return qs ? `${BUKU_KAS_PATH}?${qs}` : BUKU_KAS_PATH
}
