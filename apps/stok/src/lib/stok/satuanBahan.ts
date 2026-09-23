/**
 * Turunan kolom faktor dari isian form "Tambah Bahan".
 *
 * Form bertanya dua hal:
 *   - "1 {besar} = ... {tengah}"  → faktor_tengah   (tengah per besar)
 *   - "1 {tengah} = ... {kecil}"  → isiKecilPerTengah
 *
 * Kolom di DB (docs/MASTER-SATUAN-PO-DAN-DISTRIBUSI.md):
 *   - faktor_tampilan = satuan kecil per 1 satuan BESAR (faktor penuh)
 *   - faktor_konversi = satuan kecil per 1 satuan TENGAH (= faktor_tampilan bila tanpa tengah)
 *   - kemasan_qty (bahan_baku_harga) = faktor_tampilan
 *
 * Sebelum 2026-09-23 form mengirim isiKecilPerTengah mentah sebagai faktor_tampilan
 * dan tak mengisi faktor_konversi (default DB = 1) — sumber pelanggaran invarian
 * GAS 12 KG. Tingkat tengah yang sama dengan besar dengan isi 1 dianggap "tanpa tengah".
 */
export type IsianSatuan = {
  satuan: string
  satuan_tengah?: string | null
  faktor_tengah?: number | null
  satuan_kecil?: string | null
  isiKecilPerTengah?: number | null
}

export type FaktorSatuan = {
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_konversi: number | null
  faktor_tampilan: number | null
}

const positif = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0

export function turunkanFaktorSatuan(i: IsianSatuan): FaktorSatuan {
  const satuan = i.satuan.trim()
  const tengah = i.satuan_tengah?.trim() || null
  const kecil = i.satuan_kecil?.trim() || null
  const isiKecil = positif(i.isiKecilPerTengah) ? i.isiKecilPerTengah : null

  const tanpaTengah =
    !tengah ||
    (tengah.toLowerCase() === satuan.toLowerCase() && (i.faktor_tengah ?? 1) === 1)

  if (tanpaTengah) {
    return {
      satuan,
      satuan_tengah: null,
      faktor_tengah: null,
      satuan_kecil: kecil,
      faktor_konversi: isiKecil,
      faktor_tampilan: isiKecil,
    }
  }

  const ft = positif(i.faktor_tengah) ? i.faktor_tengah : null
  return {
    satuan,
    satuan_tengah: tengah,
    faktor_tengah: ft,
    satuan_kecil: kecil,
    faktor_konversi: isiKecil,
    faktor_tampilan: ft !== null && isiKecil !== null ? ft * isiKecil : null,
  }
}
