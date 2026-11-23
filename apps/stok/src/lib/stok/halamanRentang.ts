/**
 * Daftar rentang `.range(from, to)` untuk menarik `total` baris per halaman.
 *
 * PostgREST memotong setiap request di max-rows (1000) tanpa error, jadi
 * kartu ringkasan yang menjumlah seluruh periode wajib menarik semua halaman.
 * Dengan jumlah baris yang sudah diketahui (dari `count: 'exact'`), seluruh
 * halaman bisa diminta paralel.
 */
export function rentangHalaman(total: number, ukuran: number): [number, number][] {
  const n = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  if (n === 0 || ukuran <= 0) return []
  const out: [number, number][] = []
  for (let from = 0; from < n; from += ukuran) out.push([from, from + ukuran - 1])
  return out
}
