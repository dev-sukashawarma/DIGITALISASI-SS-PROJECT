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

export interface OutletOwnershipInput {
  id: string
  name?: string | null
  type?: string | null
}

/**
 * Apakah satu outlet dihitung sebagai outlet kemitraan. Tiga penanda, cukup
 * salah satu: `outlets.type = 'mitra'`, punya baris di `mitra_investments`,
 * atau namanya mengandung "mitra".
 *
 * `type` WAJIB ikut dibaca. HPP outlet mitra dinaikkan 1,1x berdasarkan penanda
 * yang sama di `useHpp`; kalau aturan di sini lebih sempit, outlet mitra baru
 * yang dinamai tanpa kata "MITRA" dan belum punya baris investasi akan tetap
 * kena markup di HPP-nya tanpa pendapatan margin tandingannya pernah diakui —
 * markup itu berubah jadi biaya hantu, diam-diam.
 */
export function isMitraOutlet(
  outlet: OutletOwnershipInput | null | undefined,
  mitraInvestmentIds: Set<string>,
): boolean {
  if (!outlet) return false
  if (outlet.type === 'mitra') return true
  if (mitraInvestmentIds.has(outlet.id)) return true
  return (outlet.name ?? '').toLowerCase().includes('mitra')
}

/**
 * Himpunan id outlet yang dihitung sebagai outlet kemitraan, memakai aturan
 * tunggal `isMitraOutlet`.
 */
export function mitraOutletIds(
  outlets: OutletOwnershipInput[],
  investments: Record<string, unknown>,
): Set<string> {
  const investmentIds = new Set<string>(Object.keys(investments ?? {}))
  const ids = new Set<string>(investmentIds)
  for (const outlet of outlets ?? []) {
    if (isMitraOutlet(outlet, investmentIds)) ids.add(outlet.id)
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
