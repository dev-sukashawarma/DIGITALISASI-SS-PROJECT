export type { HasilAksi } from '@/lib/pembukaanOutlet/types'

/** Langkah yang dicentang manual (sama dengan daftar di RPC centang_langkah_penutupan). */
export type KunciManual = 'kanal_online' | 'merchant_ojol' | 'mitra' | 'aset' | 'biaya_rutin'

export interface LangkahPenutupan {
  kunci: string
  label: string
  penanggungJawab: string
  wajib: boolean
  selesai: boolean
  info: string | null
  manual: boolean
  dicentangOleh: string | null
  dicentangAt: string | null
}

export interface StatusPenutupan {
  outletId: string
  nama: string
  jenis: 'internal' | 'mitra'
  status: 'active' | 'inactive'
  /** YYYY-MM-DD (WIB) — tanggal terakhir jualan. */
  nonaktifAt: string | null
  alasanTutup: string | null
  penutupanSelesaiAt: string | null
  siapSelesai: boolean
  langkah: LangkahPenutupan[]
}
