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
 *
 * Mendukung cutoff date (tanggal mulai kemitraan): bila suatu outlet beralih
 * dari internal ke mitra pada tanggal D, data sebelum D tetap dihitung sebagai
 * internal, sedangkan data mulai D dihitung sebagai mitra.
 */
export function isInScope(
  scope: ProfitScope,
  outletId: string | null | undefined,
  mitraIds: Set<string>,
  dateOrPeriod?: string | null,
  cutoffDates?: Record<string, string | null | undefined> | Map<string, string | null | undefined>,
): boolean {
  if (scope === 'all') return true
  if (!outletId) return scope === 'internal'

  let isMitra = mitraIds.has(outletId)

  if (isMitra && dateOrPeriod && cutoffDates) {
    const cutoff = cutoffDates instanceof Map ? cutoffDates.get(outletId) : cutoffDates[outletId]
    if (cutoff) {
      // Normalisasi perbandingan: ambil YYYY-MM atau YYYY-MM-DD
      const dateStr = dateOrPeriod.slice(0, 10)
      const cutoffStr = cutoff.slice(0, 10)
      if (dateStr < cutoffStr) {
        // Transaksi terjadi sebelum tanggal mulai kemitraan -> diakui sebagai internal
        isMitra = false
      }
    }
  }

  return scope === 'mitra' ? isMitra : !isMitra
}

