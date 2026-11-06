// apps/admin-dashboard/src/lib/wasteReasons.ts
//
// Kolom stok_waste_reports.reason punya DUA penulis dengan kontrak berbeda,
// dan tidak ada CHECK constraint yang menengahi:
//
//   1. apps/stok/.../WasteModal.tsx  -> dropdown 4 opsi (sebuah KATEGORI)
//      Catatan: opsi 'Lainnya' sudah DIHAPUS dari WasteModal per Nov 2026.
//   2. apps/stok/.../ManualEntryForm.tsx:220
//        reason: w.catatanItem || catatan || 'Waste'
//      -> CATATAN BEBAS yang diketik crew, atau literal 'Waste' bila dikosongkan
//
// Karena 'Lainnya' sudah tidak ada di form, grafik Breakdown per Alasan
// hanya menampilkan 4 kategori kanonik. Data historis dengan reason 'Lainnya'
// atau catatan bebas tetap tersimpan di DB dan terlihat di tabel insiden,
// namun TIDAK diikutkan di grafik agregat.

/**
 * Empat opsi dropdown WasteModal.tsx yang masih aktif.
 * 'Lainnya' sudah dihapus dari form native app — tidak lagi muncul sebagai
 * pilihan. Data historis yang masuk dengan reason 'Lainnya' atau catatan
 * bebas dari ManualEntryForm tetap tersimpan di DB, namun tidak ditampilkan
 * di grafik Breakdown per Alasan agar laporan sejajar dengan form saat ini.
 */
export const CANONICAL_WASTE_REASONS = [
  'Basi / Expired',
  'Jatuh / Tumpah',
  'Gosong / Rusak Masak',
  'Kualitas Buruk (dari supplier)',
] as const

export type CanonicalWasteReason = (typeof CANONICAL_WASTE_REASONS)[number]

/** Alasan yang berarti uang berpeluang diklaim balik ke supplier, bukan diserap sendiri. */
export const CLAIMABLE_REASON: CanonicalWasteReason = 'Kualitas Buruk (dari supplier)'

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_WASTE_REASONS)

/** True bila nilai ini berasal dari dropdown kanonik (bukan catatan bebas atau 'Lainnya' lama). */
export function isCanonicalReason(reason: string): boolean {
  return CANONICAL_SET.has(reason)
}

/**
 * Untuk grafik agregat: kembalikan reason kanonik bila ada, atau null bila
 * tidak (catatan bebas, 'Lainnya' historis, dsb). Caller harus mem-filter
 * null agar tidak muncul di chart.
 */
export function normalizeReason(reason: string): CanonicalWasteReason | null {
  return isCanonicalReason(reason) ? (reason as CanonicalWasteReason) : null
}

/**
 * Berapa INSIDEN (bukan berapa baris agregat) yang alasannya di luar keempat
 * kanonik. Dipakai untuk memberi catatan kaki pada breakdown jika diperlukan.
 */
export function countFreeTextIncidents(
  rows: { reason: string; jumlah_insiden: number }[]
): number {
  return rows.reduce(
    (sum, r) => (isCanonicalReason(r.reason) ? sum : sum + r.jumlah_insiden),
    0
  )
}
