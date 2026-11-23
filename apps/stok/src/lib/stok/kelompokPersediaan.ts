// Pengelompokan lokasi di halaman Nilai Persediaan.
//
// Dulu kartu "Gudang" = outlet_type 'office'. Itu salah dua arah:
//   - KANTOR PUSAT (type 'office', lokasi dummy) ikut terhitung gudang;
//   - GUDANG SS ONLINE (type 'gudang') terhitung sebagai outlet.
// Gudang Pusat sendiri ber-type 'office' (bukan 'gudang'), jadi dikenali lewat id.
//
// Lokasi non-operasional (office selain Gudang Pusat, test, system, dst.)
// dipisah ke 'lainnya' — TIDAK dibuang, karena view nilai_persediaan_spv
// memang memasukkannya ke total; total halaman tidak boleh berubah diam-diam.
import { GUDANG_PUSAT_ID } from './penyesuaianVendor'

export type KelompokPersediaan = 'gudang' | 'outlet' | 'lainnya'

type LokasiPersediaan = { outlet_id: string; outlet_type: string | null }

const TYPE_OUTLET_OPERASIONAL = ['internal', 'mitra']

export function kelompokLokasiPersediaan(o: LokasiPersediaan): KelompokPersediaan {
  if (o.outlet_id === GUDANG_PUSAT_ID || o.outlet_type === 'gudang') return 'gudang'
  // Type kosong diperlakukan sebagai outlet (perilaku lama untuk non-'office').
  if (o.outlet_type == null || TYPE_OUTLET_OPERASIONAL.includes(o.outlet_type)) return 'outlet'
  return 'lainnya'
}

export function bagiKelompokPersediaan<T extends LokasiPersediaan>(
  lokasi: T[]
): Record<KelompokPersediaan, T[]> {
  const hasil: Record<KelompokPersediaan, T[]> = { gudang: [], outlet: [], lainnya: [] }
  for (const o of lokasi) hasil[kelompokLokasiPersediaan(o)].push(o)
  return hasil
}
