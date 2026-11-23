/**
 * Aturan isian opname (keputusan owner, 8 September 2026):
 * - kolom KOSONG = belum dihitung -> bahan dilewati, saldo sistem tidak berubah
 * - kolom berisi 0 = sudah dihitung, fisiknya habis -> saldo dinolkan
 *
 * Kolom input HTML yang diketik lalu dihapus bernilai "" (bukan undefined).
 * Dulu form memeriksa `!== undefined`, sehingga "" dianggap terisi lalu
 * `Number("") = 0` -- stok dinolkan diam-diam. Semua predikat "terisi" di form
 * opname WAJIB lewat modul ini supaya "" dan spasi selalu diperlakukan kosong.
 *
 * Modul murni (tanpa React/Supabase) supaya bisa diuji sebagai fungsi biasa.
 */

export type LevelSatuan = 'besar' | 'tengah' | 'kecil'

export interface IsianSatuan {
  besar?: string
  tengah?: string
  kecil?: string
}

const LEVEL: LevelSatuan[] = ['besar', 'tengah', 'kecil']

/** True bila nilai satu kolom dianggap belum diisi (undefined, null, "" atau spasi). */
export function isNilaiKosong(v: unknown): boolean {
  if (v === undefined || v === null) return true
  if (typeof v === 'number') return !Number.isFinite(v)
  if (typeof v !== 'string') return true
  return v.trim() === ''
}

/** True bila minimal satu level berisi nilai (termasuk "0" yang sengaja diketik). */
export function isIsianTerisi(inp: IsianSatuan | null | undefined): boolean {
  if (!inp) return false
  return LEVEL.some((l) => !isNilaiKosong(inp[l]))
}

/**
 * Isian baru setelah satu level diubah. Nilai kosong MENGHAPUS kunci level
 * itu, bukan menyimpan "" -- supaya state, draft localStorage, dan draft server
 * tidak pernah memuat "" sama sekali.
 */
export function aturNilaiIsian(
  prev: IsianSatuan | undefined,
  level: LevelSatuan,
  value: string,
): IsianSatuan {
  const next: IsianSatuan = { ...(prev || {}) }
  if (isNilaiKosong(value)) delete next[level]
  else next[level] = value
  return next
}

/**
 * Buang level yang kosong dari satu isian. Mengembalikan undefined bila tak ada
 * yang tersisa. Nilai angka (dari JSON lama) dijadikan string; tipe lain dibuang.
 */
export function bersihkanIsian(inp: unknown): IsianSatuan | undefined {
  if (!inp || typeof inp !== 'object') return undefined
  const src = inp as Record<string, unknown>
  const hasil: IsianSatuan = {}
  for (const l of LEVEL) {
    const v = src[l]
    if (isNilaiKosong(v)) continue
    hasil[l] = String(v)
  }
  return Object.keys(hasil).length > 0 ? hasil : undefined
}

/** Peta bahanId -> isian, dibersihkan; bahan yang seluruh isiannya kosong dibuang. */
export function bersihkanPetaIsian(peta: unknown): Record<string, IsianSatuan> {
  if (!peta || typeof peta !== 'object' || Array.isArray(peta)) return {}
  const hasil: Record<string, IsianSatuan> = {}
  for (const [id, inp] of Object.entries(peta as Record<string, unknown>)) {
    const bersih = bersihkanIsian(inp)
    if (bersih) hasil[id] = bersih
  }
  return hasil
}

/**
 * Peta bahanId -> vendorId -> isian (opname per vendor Gudang Pusat).
 * Kunci vendor DIPERTAHANKAN walau isiannya kosong ({}), karena jumlah kunci
 * vendor dipakai `totalSubVendor` untuk membedakan "kosong semua" dari
 * "sebagian terisi".
 */
export function bersihkanPetaVendor(peta: unknown): Record<string, Record<string, IsianSatuan>> {
  if (!peta || typeof peta !== 'object' || Array.isArray(peta)) return {}
  const hasil: Record<string, Record<string, IsianSatuan>> = {}
  for (const [bahanId, perVendor] of Object.entries(peta as Record<string, unknown>)) {
    if (!perVendor || typeof perVendor !== 'object' || Array.isArray(perVendor)) continue
    const vendorBersih: Record<string, IsianSatuan> = {}
    for (const [vendorId, inp] of Object.entries(perVendor as Record<string, unknown>)) {
      vendorBersih[vendorId] = bersihkanIsian(inp) ?? {}
    }
    hasil[bahanId] = vendorBersih
  }
  return hasil
}

/**
 * Bahan yang pernah terisi di perangkat ini lalu dikosongkan lagi ("belum dihitung").
 * Baris draft server-nya harus dihapus; kalau tidak, angka lama (sering 0) ikut
 * difinalisasi karena penyimpanan draft hanya upsert. Sengaja hanya bahan yang
 * PERNAH terisi di perangkat ini -- hitungan perangkat lain untuk bahan yang tak
 * disentuh di sini tidak boleh ikut terhapus.
 */
export function bahanDikosongkan(pernahTerisi: Set<string>, bahanDikirim: string[]): string[] {
  const dikirim = new Set(bahanDikirim)
  return [...pernahTerisi].filter((id) => !dikirim.has(id))
}
