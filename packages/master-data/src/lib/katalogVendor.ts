/**
 * Fungsi murni katalog harga vendor.
 * Satu-satunya angka yang boleh dibandingkan antar vendor adalah harga per
 * SATUAN KECIL — vendor bisa menota dalam kemasan yang berbeda.
 */
export type BarisKatalog = {
  supplier_id: string
  supplier_nama: string
  satuan_beli: string
  isi_satuan_kecil: number
  harga: number
  is_active: boolean
  perlu_ditinjau: boolean
}

export type BarisSetara = BarisKatalog & {
  hargaPerSatuanKecil: number | null
  /** Persen di atas vendor sah termurah. null = tidak dipakai sebagai acuan. */
  selisihPersen: number | null
}

export function konversiKeSatuanKecil(qty: number, isiSatuanKecil: number): number | null {
  if (!Number.isFinite(isiSatuanKecil) || isiSatuanKecil <= 0) return null
  return qty * isiSatuanKecil
}

export function bolehPrefill(b: BarisKatalog): boolean {
  return b.is_active && !b.perlu_ditinjau && b.harga > 0 && b.isi_satuan_kecil > 0
}

export function setarakanHargaAntarVendor(rows: BarisKatalog[]): BarisSetara[] {
  const dihitung = rows.map((b) => ({
    ...b,
    hargaPerSatuanKecil:
      b.isi_satuan_kecil > 0 ? b.harga / b.isi_satuan_kecil : null,
  }))

  const sah = dihitung.filter(
    (b) => bolehPrefill(b) && b.hargaPerSatuanKecil !== null,
  )
  const termurah = sah.length
    ? Math.min(...sah.map((b) => b.hargaPerSatuanKecil as number))
    : null

  return dihitung
    .map((b) => ({
      ...b,
      selisihPersen:
        termurah !== null && termurah > 0 && bolehPrefill(b) && b.hargaPerSatuanKecil !== null
          ? ((b.hargaPerSatuanKecil - termurah) / termurah) * 100
          : null,
    }))
    .sort((a, z) => {
      const av = a.selisihPersen
      const zv = z.selisihPersen
      if (av === null && zv === null) return 0
      if (av === null) return 1
      if (zv === null) return -1
      return av - zv
    })
}
