// Logika murni untuk keputusan & cakupan laporan waste.

export const PESAN_SUDAH_DIPUTUSKAN =
  'Laporan sudah diputuskan oleh orang lain, muat ulang daftar.'

export type HasilKeputusan = { ok: true } | { ok: false; error: string }

/**
 * Update approve/reject memakai `.eq('status','PENDING')`. Kalau laporan sudah
 * diputuskan approver lain, update tidak mengubah baris apa pun tapi juga TIDAK
 * mengembalikan error — jadi jumlah baris yang berubah wajib diperiksa.
 */
export function nilaiKeputusan(rows: readonly unknown[] | null | undefined): HasilKeputusan {
  if (!rows || rows.length === 0) return { ok: false, error: PESAN_SUDAH_DIPUTUSKAN }
  return { ok: true }
}

/**
 * Daftar outlet yang boleh dilihat. accessible_outlet_ids() mengembalikan id
 * konkret untuk SEMUA role (role "semua outlet" mendapat seluruh id outlet),
 * jadi set kosong berarti "tidak punya outlet", bukan "semua". Pemanggil wajib
 * mengembalikan hasil kosong bila daftar ini kosong (fail-closed).
 */
export function cakupanOutletWaste(allowed: ReadonlySet<string>): string[] {
  return Array.from(allowed)
}
