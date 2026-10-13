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

export interface KonteksStokHermes {
  hariIni: string
  outlets: OutletInfo[]
  daftarBahan: () => Promise<BahanInfo[]>
  barisStok: (bahanId: string) => Promise<BarisStok[]>
  suratJalan: (opts: { status?: string; limit?: number }) => Promise<SuratJalanRingkas[]>
}
