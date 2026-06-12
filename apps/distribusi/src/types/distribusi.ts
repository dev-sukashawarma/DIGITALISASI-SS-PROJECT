export type SuratJalanStatus = 'draft' | 'dikirim' | 'diterima_sebagian' | 'diterima_lengkap'
export type KondisiItem = 'baik' | 'rusak' | 'hilang_qty'

export interface SuratJalan {
  id: string
  outlet_id: string
  status: SuratJalanStatus
  created_by: string | null
  created_at: string
  updated_at: string
  notes: string | null
  signatures: Array<{ user_id: string; timestamp: string; [key: string]: any }> | null
}

export interface SuratJalanItem {
  id: string
  surat_jalan_id: string
  bahan_baku_id: string
  qty_dikirim: number
  qty_terima: number | null
  kondisi: KondisiItem | null
  selisih: number
  flagged: boolean
  foto_path: string | null
  catatan: string | null
  verified_by: string | null
  verified_at: string | null
}

export interface CreateSuratJalanPayload {
  outlet_id: string
  items: Array<{ bahan_baku_id: string; qty_dikirim: number }>
}

export interface VerifyItemPayload {
  surat_jalan_id: string
  item_id: string
  qty_terima: number
  kondisi: KondisiItem
  foto_path: string | null
}
