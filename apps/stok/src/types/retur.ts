import { BahanBaku } from './stok'

export type ReturStokStatus =
  | 'diajukan'
  | 'disetujui_manager'
  | 'dalam_pengiriman'
  | 'diterima_kitchen'
  | 'menunggu_stok'
  | 'dikirim_pengganti'
  | 'selesai'
  | 'ditolak'

export type JenisLogistik =
  | 'internal'
  | 'lalamove'
  | 'gosend'
  | 'grabexpress'
  | 'deliveree'
  | 'lainnya'

export type TipeRetur = 'inbound_sj' | 'chiller_outlet'

export interface ReturStokItem {
  id: string
  retur_stok_id: string
  bahan_baku_id: string
  qty_klaim: number
  qty_diterima_kitchen: number | null
  foto_fisik_url: string
  foto_timbangan_url?: string | null
  alasan: string
  catatan: string | null
  created_at: string
  bahan_baku?: BahanBaku
}

export interface ReturStok {
  id: string
  nomor_retur: string
  outlet_id: string
  tipe_retur: TipeRetur
  status: ReturStokStatus
  approved_by_manager: string | null
  approved_manager_at: string | null
  catatan_manager: string | null
  jenis_logistik: JenisLogistik
  nomor_resi_order: string | null
  driver_nama: string | null
  driver_kontak: string | null
  driver_plat_kendaraan: string | null
  foto_serah_terima_url: string | null
  diserahkan_driver_at: string | null
  verified_by_kitchen: string | null
  verified_kitchen_at: string | null
  catatan_kitchen: string | null
  ref_surat_jalan_asal_id: string | null
  ref_surat_jalan_pengganti_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  outlets?: { id: string; name: string } | null
  created_by_staff?: { name: string } | null
  approved_by_staff?: { name: string } | null
  verified_by_staff?: { name: string } | null
  items?: ReturStokItem[]
  surat_jalan_pengganti?: { id: string; nomor_surat: string; document_number?: string; status: string } | null
}
