import {
  setarakanHargaAntarVendor,
  bolehPrefill,
  type BarisKatalog,
  type BarisSetara,
} from './katalogVendor'

/** Satu baris katalog beserta konteks bahan & vendornya, seperti dibaca hook. */
export type BarisKatalogVendor = BarisKatalog & {
  id: string
  bahan_baku_id: string
  bahan: string
  satuan: string | null
  satuan_po: string | null
  faktor_po: number | null
  termin_hari: number | null
  sumber: string
  /** Kapan harga ini terakhir disentuh. Spec §6 ④ meminta ini tampil. */
  harga_updated_at: string | null
  /**
   * Harga master bahan ini, DISETARAKAN ke satuan kecil (`harga_beli / kemasan_qty`).
   * Sama untuk semua vendor bahan yang sama; dibawa per baris karena hook
   * meratakan hasil embed. null bila harga master belum diisi.
   */
  harga_master_per_kecil: number | null
}

export type VendorSetara = BarisKatalogVendor & Pick<BarisSetara, 'hargaPerSatuanKecil' | 'selisihPersen'>

export type KelompokBahan = {
  bahan_baku_id: string
  bahan: string
  satuan: string | null
  satuan_po: string | null
  faktor_po: number | null
  /** Harga master per satuan kecil, untuk dibandingkan dengan harga vendor. */
  hargaMasterPerKecil: number | null
  vendors: VendorSetara[]
  jumlahVendor: number
  /** Vendor yang harganya layak dipakai: aktif, tidak perlu ditinjau, harga > 0. */
  jumlahBerharga: number
  /** Pembanding baru bermakna kalau ada dua harga yang layak. */
  bisaDibandingkan: boolean
}

export type RingkasanKatalog = {
  totalBaris: number
  terpercaya: number
  perluDiisi: number
  bahanMultivendor: number
  bisaDibandingkan: number
}

export function kelompokkanKatalog(rows: BarisKatalogVendor[]): KelompokBahan[] {
  const per = new Map<string, BarisKatalogVendor[]>()
  for (const r of rows) {
    const daftar = per.get(r.bahan_baku_id)
    if (daftar) daftar.push(r)
    else per.set(r.bahan_baku_id, [r])
  }

  const kelompok: KelompokBahan[] = []
  for (const daftar of per.values()) {
    // setarakanHargaAntarVendor bertipe BarisKatalog -> BarisSetara, jadi kolom
    // tambahan (id, bahan, termin) tak terbawa di tingkat tipe. Digabung ulang
    // lewat supplier_id; urutan hasil aslinya dipertahankan.
    const asal = new Map(daftar.map((r) => [r.supplier_id, r]))
    const vendors: VendorSetara[] = setarakanHargaAntarVendor(daftar).map((s) => ({
      ...(asal.get(s.supplier_id) as BarisKatalogVendor),
      hargaPerSatuanKecil: s.hargaPerSatuanKecil,
      selisihPersen: s.selisihPersen,
    }))

    const jumlahBerharga = daftar.filter(bolehPrefill).length
    const pertama = daftar[0]

    kelompok.push({
      bahan_baku_id: pertama.bahan_baku_id,
      bahan: pertama.bahan,
      satuan: pertama.satuan,
      satuan_po: pertama.satuan_po,
      faktor_po: pertama.faktor_po,
      hargaMasterPerKecil: pertama.harga_master_per_kecil,
      vendors,
      jumlahVendor: daftar.length,
      jumlahBerharga,
      bisaDibandingkan: jumlahBerharga > 1,
    })
  }

  return kelompok.sort((a, z) => a.bahan.localeCompare(z.bahan, 'id'))
}

export function ringkasKatalog(kelompok: KelompokBahan[]): RingkasanKatalog {
  let totalBaris = 0
  let terpercaya = 0
  let bahanMultivendor = 0
  let bisaDibandingkan = 0

  for (const k of kelompok) {
    totalBaris += k.jumlahVendor
    terpercaya += k.jumlahBerharga
    if (k.jumlahVendor > 1) bahanMultivendor += 1
    if (k.bisaDibandingkan) bisaDibandingkan += 1
  }

  return {
    totalBaris,
    terpercaya,
    perluDiisi: totalBaris - terpercaya,
    bahanMultivendor,
    bisaDibandingkan,
  }
}

/**
 * Cermin constraint DB, supaya operator melihat pesan alih-alih galat 400.
 * NaN diperiksa terpisah: di Postgres `'NaN'::numeric > 0` bernilai true,
 * jadi CHECK di tabel TIDAK menahannya.
 */
export function validasiBarisKatalog(input: {
  harga: number
  isi_satuan_kecil: number
  satuan_beli: string
}): string | null {
  if (!input.satuan_beli.trim()) return 'Satuan beli wajib diisi.'
  if (!Number.isFinite(input.isi_satuan_kecil) || input.isi_satuan_kecil <= 0) {
    return 'Isi satuan kecil harus lebih dari 0.'
  }
  if (!Number.isFinite(input.harga) || input.harga < 0) return 'Harga tidak boleh negatif.'
  return null
}
