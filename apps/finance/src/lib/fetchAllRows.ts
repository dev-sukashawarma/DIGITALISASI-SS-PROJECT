/**
 * Ambil SELURUH baris hasil query PostgREST, menembus batas `db-max-rows`.
 *
 * PostgREST (Supabase) memotong respons di 1.000 baris TANPA memunculkan error —
 * `error` tetap null, sehingga pemanggil mengira datanya lengkap. Untuk laporan
 * keuangan ini fatal: omzet 1–4 Agu 2026 tampil Rp 140.191.319 padahal
 * sebenarnya Rp 163.311.155 (−14%), dan tab "Penjualan per Item" cuma
 * menampilkan 4 dari 21 outlet.
 *
 * Helper ini mengambil per potongan `PAGE_SIZE` lalu memverifikasi jumlah baris
 * yang terkumpul terhadap `count` exact dari server. Kalau tidak cocok →
 * LEMPAR ERROR. Laporan keuangan lebih baik gagal terang-terangan daripada
 * merender angka yang diam-diam kurang.
 *
 * Kontrak pemanggil (dua-duanya WAJIB):
 *  1. `.select(cols, { count: 'exact' })` — tanpa ini verifikasi tak bisa jalan.
 *  2. `.order(...)` pada kolom yang membentuk grain unik baris. Paginasi tanpa
 *     urutan stabil bisa melewatkan atau menggandakan baris antar potongan.
 */

const PAGE_SIZE = 1000

/** Batas pengaman: 200 potongan = 200.000 baris. */
const MAX_PAGES = 200

interface RangeResult<T> {
  data: T[] | null
  error: { message: string } | null
  count: number | null
}

interface RangeableQuery<T> {
  range(from: number, to: number): PromiseLike<RangeResult<T>>
}

/**
 * @param buildQuery Factory yang mengembalikan query BARU tiap dipanggil.
 *   Wajib factory, bukan satu instance: query builder Supabase bersifat
 *   thenable sekali-pakai, memakai ulang instance yang sama akan gagal.
 * @param label Nama sumber data, dipakai di pesan error.
 */
export async function fetchAllRows<T>(
  buildQuery: () => RangeableQuery<T>,
  label: string
): Promise<T[]> {
  const rows: T[] = []
  let expected: number | null = null

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error, count } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)

    const batch = data ?? []
    rows.push(...batch)

    // `count` exact dilaporkan di tiap respons; ambil dari potongan pertama.
    if (expected === null && typeof count === 'number') expected = count

    if (batch.length < PAGE_SIZE) break

    if (page === MAX_PAGES - 1) {
      throw new Error(
        `${label}: melebihi ${MAX_PAGES * PAGE_SIZE} baris. Persempit rentang tanggal.`
      )
    }
  }

  if (expected !== null && rows.length !== expected) {
    throw new Error(
      `${label}: data tidak lengkap — server melaporkan ${expected} baris, ` +
        `diterima ${rows.length}. Angka tidak ditampilkan agar tidak menyesatkan.`
    )
  }

  return rows
}
