export type PermintaanStatus = 'menunggu' | 'disetujui' | 'ditolak' | 'dibatalkan'

export interface PermintaanItem {
  id: string
  permintaan_id: string
  bahan_baku_id: string
  nama?: string
  satuan?: string
  qty_diminta: number
  qty_disetujui: number | null
}

export interface Permintaan {
  id: string
  outlet_id: string
  dibuat_oleh: string
  status: PermintaanStatus
  catatan_kitchen: string | null
  surat_jalan_id: string | null
  target_metadata: any
  created_at: string
  updated_at: string
}

export interface PermintaanWithItems extends Permintaan {
  items: PermintaanItem[]
  outlet_name?: string
  staff_name?: string
}

export interface BuatPermintaanItemInput {
  bahan_baku_id: string
  qty_diminta: number
}

export interface ApproveItemInput {
  bahan_baku_id: string
  qty_disetujui: number
}
