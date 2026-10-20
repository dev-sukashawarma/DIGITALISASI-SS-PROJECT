import type { BahanInfo, BarisStok } from '@/lib/sukaBot/alat/stok'
import type { OutletInfo } from '@/lib/sukaBot/alat/penjualan'

export interface SuratJalanItemRingkas {
  bahan: string
  satuan: string
  qty_dikirim: number
  qty_terima: number | null
  kondisi: string | null
  selisih: number | null
}

export interface SuratJalanRingkas {
  id: string
  outlet: string
  status: string
  tanggal: string | null
  item: SuratJalanItemRingkas[]
}

export interface AktivitasStokRingkas {
  outlet: string
  tanggal: string
  status: string
  tipe?: string
}

export interface WasteItemRingkas {
  bahan: string
  satuan: string
  total_qty: number
  frekuensi: number
  estimasi_kerugian: number
  faktor_dominan: string
}

export interface WasteOutletRingkas {
  outlet: string
  frekuensi: number
  total_qty: number
}

export interface HasilWasteHermes {
  rentang_hari: number
  total_laporan: number
  total_estimasi_kerugian: number
  top_bahan: WasteItemRingkas[]
  top_outlet: WasteOutletRingkas[]
}

export interface KonteksStokHermes {
  hariIni: string
  outlets: OutletInfo[]
  daftarBahan: () => Promise<BahanInfo[]>
  barisStok: (bahanId: string) => Promise<BarisStok[]>
  suratJalan: (opts: { status?: string; limit?: number }) => Promise<SuratJalanRingkas[]>
  opname: (opts: { outlet?: string; hari: number; limit: number }) => Promise<AktivitasStokRingkas[]>
  permintaanBahan: (opts: { outlet?: string; hari: number; limit: number }) => Promise<AktivitasStokRingkas[]>
  waste: (opts: { outlet?: string; bahan?: string; hari: number; limit: number }) => Promise<HasilWasteHermes>
}
