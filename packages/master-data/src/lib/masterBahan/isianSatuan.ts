import type { TingkatSatuan } from './satuanBeli'
import { bacaAngka, tulisAngka } from './angka'

export type NilaiSatuan = {
  satuan: string
  satuan_tengah: string
  faktor_tengah: string
  satuan_kecil: string
  isi_kecil_per_tengah: string
}

export type DataSatuan = {
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  isi_kecil_per_tengah: number
}

const positif = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0
const angkaAtauNull = (s: string): number | null => bacaAngka(s)

/** Isian form dari data master: isi kecil per TENGAH (atau per besar bila tanpa tengah). */
export function nilaiSatuanDari(b: TingkatSatuan): NilaiSatuan {
  const isi =
    b.satuan_tengah && positif(b.faktor_tengah) && positif(b.faktor_tampilan)
      ? b.faktor_tampilan / b.faktor_tengah
      : b.faktor_tampilan
  return {
    satuan: b.satuan ?? '',
    satuan_tengah: b.satuan_tengah ?? '',
    faktor_tengah: positif(b.faktor_tengah) ? tulisAngka(b.faktor_tengah) : '',
    satuan_kecil: b.satuan_kecil ?? '',
    isi_kecil_per_tengah: positif(isi) ? tulisAngka(isi) : '',
  }
}

/** Kunci satuan untuk simpan_bahan_baku — dikirim sebagai satu set. */
export function keDataSatuan(v: NilaiSatuan): DataSatuan {
  return {
    satuan: v.satuan.trim(),
    satuan_tengah: v.satuan_tengah.trim() || null,
    faktor_tengah: angkaAtauNull(v.faktor_tengah),
    satuan_kecil: v.satuan_kecil.trim() || null,
    isi_kecil_per_tengah: angkaAtauNull(v.isi_kecil_per_tengah) ?? 1,
  }
}

/** Faktor tampilan hasil turunan (dipakai pratinjau & pilihan satuan beli di form bahan baru). */
export function faktorTampilanDari(d: DataSatuan): number | null {
  if (!d.satuan_kecil) return null
  const perTengah = d.isi_kecil_per_tengah ?? 1
  return d.satuan_tengah && d.faktor_tengah ? d.faktor_tengah * perTengah : perTengah
}

/**
 * True bila isian satuan belum lengkap atau angkanya tidak dikenali:
 *   - satuan besar kosong
 *   - satuan tengah diisi tapi faktor_tengah kosong
 *   - satuan kecil diisi tapi isi_kecil_per_tengah kosong
 *   - faktor_tengah / isi_kecil_per_tengah terisi tapi gagal dibaca atau ≤ 0
 */
export function satuanInvalid(v: NilaiSatuan): boolean {
  if (v.satuan.trim() === '') return true
  if (v.satuan_tengah.trim() !== '' && v.faktor_tengah.trim() === '') return true
  if (v.satuan_kecil.trim() !== '' && v.isi_kecil_per_tengah.trim() === '') return true
  for (const s of [v.faktor_tengah, v.isi_kecil_per_tengah]) {
    const t = s.trim()
    if (t === '') continue
    const n = bacaAngka(t)
    if (n === null || !(n > 0)) return true
  }
  return false
}
