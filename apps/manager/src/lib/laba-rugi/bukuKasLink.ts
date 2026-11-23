export const BUKU_KAS_PATH = '/buku-kas'
export const BUKU_KAS_PARAMS = { from: 'from', to: 'to', outlet: 'outlet', source: 'sumber', category: 'kategori' } as const

export function bukuKasHref(
  filter: { from: string; to: string; outletId: string },
  scope: 'all' | 'internal' | 'mitra' = 'all',
): string {
  const q = new URLSearchParams()
  if (filter.from) q.set(BUKU_KAS_PARAMS.from, filter.from)
  if (filter.to) q.set(BUKU_KAS_PARAMS.to, filter.to)
  const outlet = filter.outletId === 'all' && scope !== 'all'
    ? (scope === 'mitra' ? 'MITRA_OUTLETS' : 'INTERNAL_OUTLETS')
    : filter.outletId
  if (outlet) q.set(BUKU_KAS_PARAMS.outlet, outlet)
  const qs = q.toString()
  return qs ? `${BUKU_KAS_PATH}?${qs}` : BUKU_KAS_PATH
}

export type KartuOpex = 'bulanan' | 'lembur' | 'kasKecil' | 'pusat' | 'total'

export function bukuKasHrefKartu(
  filter: { from: string; to: string; outletId: string },
  scope: 'all' | 'internal' | 'mitra',
  kartu: KartuOpex,
): string {
  const q = new URLSearchParams()
  if (filter.from) q.set(BUKU_KAS_PARAMS.from, filter.from)
  if (filter.to) q.set(BUKU_KAS_PARAMS.to, filter.to)

  const satuOutlet = filter.outletId && filter.outletId !== 'all'
  const outletSaja = satuOutlet
    ? filter.outletId
    : scope === 'mitra' ? 'MITRA_OUTLETS' : scope === 'internal' ? 'INTERNAL_OUTLETS' : 'ALL_OUTLETS'
  const cakupanPenuh = satuOutlet
    ? filter.outletId
    : scope === 'mitra' ? 'MITRA_OUTLETS' : scope === 'internal' ? 'INTERNAL_PUSAT' : 'all'

  if (kartu === 'pusat') {
    q.set(BUKU_KAS_PARAMS.outlet, 'PUSAT')
  } else if (kartu === 'total') {
    q.set(BUKU_KAS_PARAMS.outlet, cakupanPenuh)
  } else {
    q.set(BUKU_KAS_PARAMS.outlet, outletSaja)
    if (kartu === 'bulanan') q.set(BUKU_KAS_PARAMS.source, 'monthly')
    if (kartu === 'kasKecil') q.set(BUKU_KAS_PARAMS.source, 'petty_cash')
    if (kartu === 'lembur') q.set(BUKU_KAS_PARAMS.category, 'lembur')
  }
  return `${BUKU_KAS_PATH}?${q.toString()}`
}

export const PETTY_CASH_PATH = '/petty-cash'
export const PETTY_CASH_PARAMS = { from: 'from', to: 'to', outletId: 'outletId' } as const

export function pettyCashHref(filter: { from: string; to: string; outletId: string }): string {
  const q = new URLSearchParams()
  if (filter.from) q.set(PETTY_CASH_PARAMS.from, filter.from)
  if (filter.to) q.set(PETTY_CASH_PARAMS.to, filter.to)
  if (filter.outletId) q.set(PETTY_CASH_PARAMS.outletId, filter.outletId)
  const qs = q.toString()
  return qs ? `${PETTY_CASH_PATH}?${qs}` : PETTY_CASH_PATH
}
