/**
 * Kunci harga aplikasi di `menu_items.channel_prices`.
 *
 * Nilainya HARUS sama dengan yang dibaca gateway di
 * `apps/retail-gateway/src/lib/catalog.ts` (`SLUG_HARGA_APLIKASI`). Kalau
 * keduanya bergeser, admin mengisi harga yang tidak pernah dipakai siapa pun.
 *
 * Slug ini sengaja TIDAK punya baris di tabel `sales_channels`: mode
 * "Satu Harga Semua" di layar menu POS menyapu seluruh baris tabel itu dan
 * akan ikut menimpa harga aplikasi setiap kali harga food apps diatur.
 */
export const SLUG_APLIKASI = 'aplikasi'

/**
 * Menyisipkan harga aplikasi ke `channel_prices` tanpa merusak kanal lain.
 *
 * `channel_prices` satu objek untuk SEMUA kanal. Menulisnya utuh dengan
 * `{ aplikasi: ... }` menghapus harga GoFood, GrabFood, dan ShopeeFood dalam
 * satu klik — itulah sebabnya penulisan harga aplikasi hanya boleh lewat sini.
 *
 * Harga kosong/nol/tak masuk akal berarti "ikut harga kasir": kuncinya dihapus,
 * bukan disimpan sebagai '0'. Gateway memang memperlakukan 0 sebagai
 * tidak-diisi, tapi menyimpan '0' membuat niat admin tak terbaca oleh manusia
 * yang kelak membuka baris itu.
 */
export function gabungHargaChannel(
  lama: unknown,
  harga: string | number | null | undefined,
): Record<string, string> {
  let obj: unknown = lama
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj) } catch { obj = {} }
  }

  const hasil: Record<string, string> = {}
  if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === SLUG_APLIKASI) continue
      hasil[k] = String(v)
    }
  }

  if (harga === null || harga === undefined || harga === '') return hasil

  const angka = Number(harga)
  if (!Number.isFinite(angka) || angka <= 0) return hasil

  hasil[SLUG_APLIKASI] = String(angka)
  return hasil
}
