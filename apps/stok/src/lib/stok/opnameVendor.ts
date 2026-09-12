/**
 * Opname Gudang Pusat per vendor — untuk bahan multi-vendor (spec §4.5,
 * 2026-09-11-saldo-vendor-gudang).
 *
 * Aturan: bahan yang dipasok >1 vendor induk (mis. SAPI, AYAM) dihitung
 * PER VENDOR saat opname di Gudang Pusat, bukan satu angka gabungan --
 * karena saldo per vendor (`stok_vendor_gudang_mutasi`) hanya dikoreksi lewat
 * hitungan per vendor (RPC `simpan_hitung_vendor`), lihat migration
 * `20260911153000_saldo_vendor_opname.sql`.
 *
 * Modul ini murni aritmetika (tanpa React/Supabase) supaya bisa diuji sebagai
 * fungsi biasa. Ia sengaja TIDAK tahu soal saldo sistem/`sisa` -- hitung buta
 * dipertahankan (angka sistem tak boleh memengaruhi hitungan fisik).
 */

/** Isian satu vendor untuk satu bahan, satu level per satuan (sama seperti baris utama). */
export interface SubVendorInput {
  besar?: string
  tengah?: string
  kecil?: string
}

/** Subset kolom `bahan_baku` yang dibutuhkan untuk konversi antar level satuan. */
export interface BahanFaktorUnit {
  satuan_tengah?: string | null
  faktor_tengah?: number | null
  satuan_kecil?: string | null
  faktor_tampilan?: number | null
}

export interface TotalSubVendorResult {
  /** Total gabungan dalam SATUAN BESAR bahan; null bila belum bisa dihitung. */
  total: number | null
  /** True bila sebagian vendor terisi dan sebagian belum -- keadaan wajib diblokir. */
  sebagian: boolean
}

/** True bila isian vendor ini punya nilai di level manapun (termasuk "0" yang sengaja diketik). */
function isFilled(input: SubVendorInput | undefined): boolean {
  return !!input && (input.besar !== undefined || input.tengah !== undefined || input.kecil !== undefined)
}

/** Jumlah satuan besar dalam satuan kecil (dasar konversi seluruh level). */
function unitBesarInKecil(b: BahanFaktorUnit): number {
  return b.faktor_tampilan || 1
}

/** Jumlah satuan tengah dalam satuan kecil (0 kalau bahan tak punya tengah/tampilan). */
function unitTengahInKecil(b: BahanFaktorUnit): number {
  const besarInKecil = unitBesarInKecil(b)
  return b.faktor_tengah ? besarInKecil / b.faktor_tengah : 1
}

/**
 * Total satu vendor, dikonversi ke SATUAN BESAR bahan.
 *
 * Rumus identik dengan `calculateTotalFisik` baris utama (OpnameForm.tsx) --
 * sengaja disalin, bukan diimpor, karena kedua fungsi punya kontrak return
 * berbeda (satuan kecil vs satuan besar) dan modul ini harus tetap murni
 * tanpa bergantung pada komponen React.
 */
export function singleVendorBesar(input: SubVendorInput, b: BahanFaktorUnit): number {
  const besar = Number(input.besar || 0)
  const tengah = Number(input.tengah || 0)
  const kecil = Number(input.kecil || 0)

  let totalKecil: number
  if (b.satuan_tengah && b.satuan_kecil) {
    totalKecil = besar * unitBesarInKecil(b) + tengah * unitTengahInKecil(b) + kecil
  } else if (b.satuan_kecil) {
    totalKecil = besar * unitBesarInKecil(b) + kecil
  } else {
    totalKecil = besar * unitBesarInKecil(b)
  }

  return totalKecil / unitBesarInKecil(b)
}

/**
 * Total sub-baris per vendor untuk satu bahan, dalam SATUAN BESAR (dipakai
 * sebagai nilai baris utama read-only).
 *
 * - `sub` kosong atau semua vendornya belum diisi -> `{total:null, sebagian:false}`
 *   (bahan dilewati, perilaku lama).
 * - Sebagian vendor terisi, sebagian belum -> `{total:null, sebagian:true}`
 *   (harus diblokir Simpan Draft/Finalisasi -- RPC `simpan_hitung_vendor` pun
 *   menolak kiriman yang tidak memuat SEMUA vendor induk bahan itu).
 * - Semua vendor terisi (termasuk yang diisi "0" -- itu tetap "terisi", bukan
 *   kosong) -> total dihitung dari faktor_tengah/faktor_tampilan bahan.
 */
export function totalSubVendor(
  sub: Record<string, SubVendorInput>,
  b: BahanFaktorUnit
): TotalSubVendorResult {
  const entries = Object.values(sub || {})
  if (entries.length === 0) return { total: null, sebagian: false }

  const filled = entries.filter(isFilled)
  if (filled.length === 0) return { total: null, sebagian: false }
  if (filled.length < entries.length) return { total: null, sebagian: true }

  const total = filled.reduce((acc, input) => acc + singleVendorBesar(input, b), 0)
  return { total, sebagian: false }
}

/**
 * Saring hasil resume draft server-side (`fetchTodayDraft`), membuang bahan
 * yang diketahui multi-vendor.
 *
 * Kenapa: resume server-side saat ini hanya memulihkan angka gabungan lama
 * dari `opname_item.catatan` -- ia TIDAK memulihkan sub-baris per vendor
 * (`opname_item_vendor` disimpan terpisah, lihat Task 8 report §"Deviasi").
 * Kalau angka gabungan itu tetap diterapkan untuk bahan yang (ternyata)
 * multi-vendor, badge "Terisi" menyala padahal `subInputs`-nya kosong --
 * `simpan_hitung_vendor` lalu dikirim TANPA baris untuk bahan itu sama
 * sekali, dan tak ada gerbang lain yang menangkapnya (kosong-semua di
 * subInputs tidak beda dari "belum disentuh"). Bahan multi-vendor harus
 * mulai dari nol saat resume, bukan dari total lama yang tak punya rincian.
 *
 * Panggil ini HANYA setelah daftar bahan multi-vendor (`vendorsByBahan`
 * di OpnameForm) diketahui PASTI (`vendorsLoaded`) -- daftar yang belum
 * lengkap akan gagal menyaring bahan yang sebenarnya multi-vendor tapi belum
 * ketahuan.
 */
export function filterResumableInputs<T>(
  resumed: Record<string, T>,
  multiVendorBahanIds: Iterable<string>
): Record<string, T> {
  const skip = new Set(multiVendorBahanIds)
  const next: Record<string, T> = {}
  for (const [id, value] of Object.entries(resumed)) {
    if (skip.has(id)) continue
    next[id] = value
  }
  return next
}
