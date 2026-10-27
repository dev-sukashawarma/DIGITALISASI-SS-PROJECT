// Bentuk baris tabel & RPC pelacakan driver (migration 20261027140000–142000).

export type StatusPerjalanan = 'berjalan' | 'selesai' | 'ditutup_otomatis'
export type StatusStop = 'menunggu' | 'tiba' | 'tidak_ditandai' | 'dibatalkan'
export type SumberTiba = 'driver' | 'verifikasi_outlet'

export interface PerjalananRow {
  id: string
  driver_id: string
  status: StatusPerjalanan
  berangkat_at: string
  berangkat_lat: number | null
  berangkat_lng: number | null
  selesai_at: string | null
  total_km: number | null
  durasi_detik: number | null
}

export interface StopRow {
  id: string
  perjalanan_id: string
  surat_jalan_id: string
  outlet_id: string
  urutan: number
  status: StatusStop
  tiba_at: string | null
  tiba_sumber: SumberTiba | null
  tiba_lat: number | null
  tiba_lng: number | null
  tiba_akurasi_m: number | null
  tiba_jarak_m: number | null
}

export interface LokasiTerkiniRow {
  driver_id: string
  perjalanan_id: string | null
  lat: number
  lng: number
  akurasi_m: number | null
  kecepatan_mps: number | null
  arah_derajat: number | null
  baterai_persen: number | null
  direkam_at: string
  diterima_at: string
}

export interface TitikJejak {
  lat: number
  lng: number
  direkam_at: string
}

/** Hasil RPC status_antar_sj — sengaja tanpa koordinat. */
export interface StatusAntarSj {
  dilacak: boolean
  nama_driver: string | null
  berangkat_at: string | null
  status_stop: StatusStop | null
  tiba_at: string | null
  tiba_sumber: SumberTiba | null
  outlet_sebelum: number | null
}

/** Stop yang sudah digabung dengan info SJ & outlet untuk ditampilkan. */
export interface StopTampil extends StopRow {
  document_number: string | null
  outlet_name: string
  outlet_lat: number | null
  outlet_lng: number | null
}

export interface PerjalananTampil extends PerjalananRow {
  driver_name: string
  stops: StopTampil[]
  terkini: LokasiTerkiniRow | null
}
