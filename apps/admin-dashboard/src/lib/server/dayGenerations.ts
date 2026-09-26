// @ts-nocheck
// Hanya untuk kode server (memakai fs). Sengaja tanpa paket `server-only` —
// tidak dideklarasikan di package.json app ini (phantom dependency).
import fs from 'fs'
import path from 'path'

/* ── Nomor generasi per tanggal, disimpan di disk ─────────────────────────
 *
 * Cache laporan per hari (Rangkuman Penjualan & Ringkasan Bisnis) disimpan di
 * `.next/cache/fetch-cache`, yang di produksi dipasang sebagai volume Coolify
 * agar TAHAN REDEPLOY. Masalahnya: catatan Next.js "tag X sudah dibuang"
 * (updateTag/revalidateTag) hanya hidup di MEMORI proses. Setelah restart,
 * isi cache di disk yang sempat dibuang bisa terbaca lagi sebagai data sah.
 *
 * Solusinya nomor generasi per tanggal yang ikut masuk ke KUNCI cache dan
 * disimpan di folder volume yang sama. Setiap kali cache sebuah tanggal
 * dibuang (order lampau berubah, tombol Segarkan, impor SS Online), nomornya
 * naik → kunci berubah → entri lama tak pernah bisa terbaca lagi, termasuk
 * sesudah restart. Gagal menulis berkas tidak menggagalkan permintaan (tag
 * di memori tetap membuang cache untuk proses yang sedang berjalan).
 */

const FILE = path.join(process.cwd(), '.next', 'cache', 'fetch-cache', 'report-day-generations.json')

let gens: Record<string, number> | null = null

function load(): Record<string, number> {
  if (gens) return gens
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    gens = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    gens = {}
  }
  return gens
}

/** Generasi sebuah tanggal (0 bila belum pernah dibuang). */
export function dayGeneration(date: string): number {
  return load()[date] ?? 0
}

/** Gabungan generasi beberapa tanggal — untuk kunci cache potongan multi-hari. */
export function daysGeneration(dates: string[]): string {
  const g = load()
  return dates.map((d) => g[d] ?? 0).join('.')
}

/** Naikkan generasi tanggal-tanggal ini dan simpan ke disk. */
export function bumpDayGenerations(dates: string[]) {
  if (!dates || dates.length === 0) return
  const g = load()
  for (const d of dates) g[d] = (g[d] ?? 0) + 1
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    const tmp = `${FILE}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(g))
    fs.renameSync(tmp, FILE) // tulis-lalu-ganti-nama: berkas tak pernah setengah jadi
  } catch (e) {
    console.error('[dayGenerations] gagal menyimpan generasi tanggal:', e)
  }
}
