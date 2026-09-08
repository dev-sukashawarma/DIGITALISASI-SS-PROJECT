// apps/stok/src/lib/wasteReasons.ts
//
// Satu-satunya daftar alasan waste di app ini. Sebelumnya daftar yang sama
// di-hardcode terpisah di WasteModal.tsx dan ManualEntryForm.tsx — dua salinan
// yang bisa menyimpang diam-diam.
//
// Nilai-nilai ini masuk ke stok_waste_reports.reason dan dipakai sebagai
// KATEGORI oleh laporan di admin-dashboard (Breakdown per Alasan). Kolom itu
// tidak punya CHECK constraint, jadi disiplinnya ada di sisi form: apa pun di
// luar daftar ini akan muncul sebagai "kategori" liar di laporan.
//
// ⚠️ Ada salinan kedua di apps/admin-dashboard/src/lib/wasteReasons.ts (sisi
// baca). Dua app terpisah tanpa package bersama — menambah dependency lintas-app
// memicu masalah phantom dependency di build Docker (lihat CLAUDE.md). Kalau
// daftar ini berubah, ubah keduanya.

export const WASTE_REASONS = [
  'Basi / Expired',
  'Jatuh / Tumpah',
  'Gosong / Rusak Masak',
  'Kualitas Buruk (dari supplier)',
  'Lainnya',
] as const

export type WasteReason = (typeof WASTE_REASONS)[number]

/** True bila string ini salah satu alasan yang sah untuk dikirim ke DB. */
export function isValidWasteReason(reason: string): reason is WasteReason {
  return (WASTE_REASONS as readonly string[]).includes(reason)
}
