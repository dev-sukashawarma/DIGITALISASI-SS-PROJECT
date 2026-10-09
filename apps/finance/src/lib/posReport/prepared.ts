// @ts-nocheck
/* ── Memo "hasil siap-pakai" Rangkuman Penjualan (per proses server) ─────────
 *
 * Pindah halaman tabel, mengetik di kolom cari, atau memilih metode bayar
 * TIDAK mengubah kartu KPI, daftar channel, maupun shift. Sebelumnya setiap
 * klik itu tetap menjalankan seluruh proses: baca+decode cache 10 MB, ambil
 * ulang data hari ini, 3 query master, lalu menghitung ulang semua kartu
 * (±317 ms CPU untuk "Bulan ini") — di VPS 2 CPU yang dipakai ±20 app.
 *
 * Di sini hasil tahap berat itu disimpan sebentar per kombinasi
 * (cakupan, rentang, outlet, channel). Interaksi tabel cukup menyaring dan
 * memotong daftar yang sudah ada (±20–30 ms).
 *
 * Umur memo:
 *  - rentang yang memuat hari ini: 20 detik (sama dengan jeda realtime), agar
 *    order baru tetap muncul;
 *  - rentang lampau saja: 60 detik (sama dengan memo master menu/HPP), karena
 *    datanya hanya berubah lewat pembuangan cache yang juga mengosongkan memo ini.
 * Ukuran dibatasi total jumlah order, karena setiap entri memegang order yang
 * sudah di-decode di memori.
 */

export const PREPARED_TTL_WITH_TODAY_MS = 20_000
export const PREPARED_TTL_PAST_ONLY_MS = 60_000
const MAX_TOTAL_ORDERS = 150_000

type Entry = { at: number; ttl: number; orderCount: number; promise: Promise<any> }
const memo = new Map<string, Entry>()

function evict() {
  const now = Date.now()
  for (const [k, v] of memo) if (now - v.at >= v.ttl) memo.delete(k)
  let total = 0
  for (const v of memo.values()) total += v.orderCount
  // Map menjaga urutan sisip → buang yang paling lama dulu.
  for (const [k, v] of memo) {
    if (total <= MAX_TOTAL_ORDERS) break
    memo.delete(k)
    total -= v.orderCount
  }
}

/**
 * Ambil hasil siap-pakai untuk `key`, atau bangun dengan `build()` bila belum
 * ada/kedaluwarsa. Permintaan serentak untuk kunci yang sama berbagi satu
 * `build()`. Kegagalan tidak disimpan.
 */
export function getPrepared<T extends { orders: any[] }>(
  key: string,
  ttl: number,
  build: () => Promise<T>
): Promise<T> {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < hit.ttl) {
    // Sentuh ulang agar entri yang sering dipakai tidak terbuang duluan.
    memo.delete(key)
    memo.set(key, hit)
    return hit.promise
  }
  const entry: Entry = { at: Date.now(), ttl, orderCount: 0, promise: null as any }
  entry.promise = build().then(
    (res) => {
      entry.orderCount = res?.orders?.length ?? 0
      evict()
      return res
    },
    (err) => {
      if (memo.get(key) === entry) memo.delete(key)
      throw err
    }
  )
  memo.set(key, entry)
  return entry.promise
}

/** Kosongkan seluruh memo — dipanggil saat cache hari dibuang (realtime, Segarkan, impor). */
export function clearPrepared() {
  memo.clear()
}
