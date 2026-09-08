// apps/admin-dashboard/src/lib/wasteReasons.ts
//
// Kolom stok_waste_reports.reason punya DUA penulis dengan kontrak berbeda,
// dan tidak ada CHECK constraint yang menengahi:
//
//   1. apps/stok/.../WasteModal.tsx  -> dropdown 5 opsi (sebuah KATEGORI)
//   2. apps/stok/.../ManualEntryForm.tsx:220
//        reason: w.catatanItem || catatan || 'Waste'
//      -> CATATAN BEBAS yang diketik crew, atau literal 'Waste' bila dikosongkan
//
// Audit DB 2026-09-08 atas 369 baris APPROVED menemukan 8 nilai berbeda, bukan 5:
// selain kelima kanonik ada 'Waste' (18 baris, masih ditulis 2026-09-07),
// 'Rusak' (1), dan 'Basi dan berubah warna' (1).
//
// Tanpa normalisasi, grafik "Breakdown per Alasan" mencampur kategori dengan
// catatan bebas dan menumbuhkan "kategori" baru tiap kali seorang crew mengetik
// catatan yang berbeda.
//
// LINGKUP normalisasi ini SENGAJA hanya grafik agregat. Tabel Rincian Insiden
// dan modal detail tetap menampilkan teks asli — di level per-insiden, catatan
// itu justru informasinya.

/** Lima opsi dropdown WasteModal.tsx, verbatim. Urutan mengikuti urutan di form. */
export const CANONICAL_WASTE_REASONS = [
  'Basi / Expired',
  'Jatuh / Tumpah',
  'Gosong / Rusak Masak',
  'Kualitas Buruk (dari supplier)',
  'Lainnya',
] as const

export type CanonicalWasteReason = (typeof CANONICAL_WASTE_REASONS)[number]

/** Alasan yang berarti uang berpeluang diklaim balik ke supplier, bukan diserap sendiri. */
export const CLAIMABLE_REASON: CanonicalWasteReason = 'Kualitas Buruk (dari supplier)'

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_WASTE_REASONS)

/** True bila nilai ini berasal dari dropdown, bukan dari catatan bebas. */
export function isCanonicalReason(reason: string): boolean {
  return CANONICAL_SET.has(reason)
}

/**
 * Untuk grafik agregat: nilai kanonik dibiarkan, selain itu dilipat ke 'Lainnya'.
 * Perbandingannya persis (case-sensitive) — data nyata memakai kapitalisasi
 * identik dengan dropdown, jadi varian kapitalisasi lain berarti penulis lain
 * dan memang seharusnya ikut terlipat.
 */
export function normalizeReason(reason: string): CanonicalWasteReason {
  return isCanonicalReason(reason) ? (reason as CanonicalWasteReason) : 'Lainnya'
}

/**
 * Berapa INSIDEN (bukan berapa baris agregat) yang alasannya di luar kelima
 * kanonik. Dipakai untuk memberi catatan kaki pada bar "Lainnya": melipat
 * 'Waste' ke sana tanpa jejak akan menghapus sinyal bahwa sebagian uang masuk
 * lewat form yang tidak mengkategorikan.
 */
export function countFreeTextIncidents(
  rows: { reason: string; jumlah_insiden: number }[]
): number {
  return rows.reduce(
    (sum, r) => (isCanonicalReason(r.reason) ? sum : sum + r.jumlah_insiden),
    0
  )
}
