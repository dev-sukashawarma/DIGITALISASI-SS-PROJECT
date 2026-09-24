// Harga per vendor dalam SATUAN BESAR, untuk estimasi di layar approval.
// Cermin aturan trigger DB `fill_harga_snapshot` (migration 20260912100000),
// yang menentukan harga_snapshot surat jalan saat vendor sudah dipilih:
//   - baris katalog aktif, harga > 0, isi_satuan_kecil > 0, faktor > 0
//   - vendor dikelompokkan ke induknya (vendor_induk_id ?? supplier_id)
//   - harga = harga × (kemasan_qty || faktor_tampilan) / isi_satuan_kecil
//   - kalau satu induk punya >1 baris: harga_updated_at terbaru, lalu id
// Ubah trigger itu → ubah fungsi ini juga, supaya layar & surat jalan sepakat.

export type BarisKatalogVendor = {
  id: string
  bahan_baku_id: string
  vendor_induk: string
  harga: number | null
  isi_satuan_kecil: number | null
  is_active: boolean
  harga_updated_at: string | null
  /** kemasan_qty (bahan_baku_harga), fallback faktor_tampilan (bahan_baku). */
  faktor: number | null
}

/** bahan_baku_id → vendor_induk → harga per satuan besar. */
export type HargaVendorMap = Record<string, Record<string, number>>

export function hitungHargaVendor(baris: BarisKatalogVendor[]): HargaVendorMap {
  const terbaik = new Map<string, BarisKatalogVendor>()
  for (const r of baris) {
    if (!r.is_active) continue
    if (!(Number(r.harga) > 0) || !(Number(r.isi_satuan_kecil) > 0) || !(Number(r.faktor) > 0)) continue
    const key = `${r.bahan_baku_id}|${r.vendor_induk}`
    const lama = terbaik.get(key)
    if (!lama || lebihDulu(r, lama)) terbaik.set(key, r)
  }
  const hasil: HargaVendorMap = {}
  for (const r of terbaik.values()) {
    ;(hasil[r.bahan_baku_id] ??= {})[r.vendor_induk] =
      (Number(r.harga) * Number(r.faktor)) / Number(r.isi_satuan_kecil)
  }
  return hasil
}

// ORDER BY harga_updated_at DESC NULLS LAST, id — true bila a menang atas b.
function lebihDulu(a: BarisKatalogVendor, b: BarisKatalogVendor): boolean {
  const ta = a.harga_updated_at ? Date.parse(a.harga_updated_at) : null
  const tb = b.harga_updated_at ? Date.parse(b.harga_updated_at) : null
  if (ta !== tb) {
    if (ta === null) return false
    if (tb === null) return true
    return ta > tb
  }
  return a.id < b.id
}

/**
 * Nilai satu baris permintaan (qty dalam satuan BESAR). Porsi yang dialokasikan
 * ke vendor ber-harga katalog memakai harga vendor itu; sisanya harga master —
 * sama dengan fallback trigger. null = tidak ada harga sama sekali.
 */
export function nilaiBaris(
  qtyBesar: number,
  alokasiBesar: { vendor_id: string; qty: number }[] | undefined,
  hargaVendor: Record<string, number> | undefined,
  hargaMaster: number | undefined,
): number | null {
  let nilai = 0
  let sisa = qtyBesar
  for (const a of alokasiBesar ?? []) {
    const h = hargaVendor?.[a.vendor_id]
    if (h === undefined || !(a.qty > 0)) continue
    nilai += a.qty * h
    sisa -= a.qty
  }
  if (sisa > 1e-9) {
    if (hargaMaster === undefined) return nilai > 0 ? nilai : null
    nilai += sisa * hargaMaster
  }
  return nilai
}
