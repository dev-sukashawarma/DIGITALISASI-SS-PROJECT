/**
 * Pemisahan outlet pusat (internal) vs outlet kemitraan (mitra).
 *
 * Aturannya SATU di sini supaya layar Laba Rugi dan ekspor CSV/PDF-nya tak
 * mungkin memakai definisi "mitra" yang berbeda — sebelumnya aturan ini
 * ditulis ulang di dua tempat di dalam halaman profit.
 */

export type ProfitScope = 'all' | 'internal' | 'mitra'

/** Label manusiawi per scope, dipakai di judul halaman & nama file ekspor. */
export const SCOPE_LABEL: Record<ProfitScope, string> = {
  all: 'Semua Outlet',
  internal: 'Internal',
  mitra: 'Mitra',
}

/**
 * Himpunan id outlet yang dihitung sebagai outlet kemitraan: punya baris di
 * `mitra_investments`, atau namanya mengandung "mitra".
 */
export function mitraOutletIds(
  outlets: { id: string; name?: string | null }[],
  investments: Record<string, unknown>,
): Set<string> {
  const ids = new Set<string>(Object.keys(investments ?? {}))
  for (const outlet of outlets ?? []) {
    if ((outlet?.name ?? '').toLowerCase().includes('mitra')) ids.add(outlet.id)
  }
  return ids
}

/**
 * Apakah satu baris data (penjualan/biaya/HPP/waste) ikut dihitung pada scope
 * yang sedang dibuka. Outlet yang tak dikenal dianggap internal — outlet mitra
 * selalu punya jejak eksplisit, jadi ketidaktahuan tak boleh membesarkan angka
 * mitra.
 */
export function isInScope(
  scope: ProfitScope,
  outletId: string | null | undefined,
  mitraIds: Set<string>,
): boolean {
  if (scope === 'all') return true
  const isMitra = Boolean(outletId) && mitraIds.has(outletId as string)
  return scope === 'mitra' ? isMitra : !isMitra
}
