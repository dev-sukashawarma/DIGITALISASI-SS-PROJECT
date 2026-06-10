export type Satuan = 'kg'|'gram'|'liter'|'ml'|'pcs'|'box'|'pack'|'ikat'|'botol'
export type Kategori = 'protein'|'sayur'|'bumbu'|'saus'|'roti'|'kemasan'|'minuman'|'lainnya'
export type LedgerTipe =
  | 'terima_kiriman' | 'pemakaian' | 'waste' | 'adjustment'
  | 'opname_selisih' | 'transfer_keluar' | 'transfer_masuk'
export type OpnameTipe = 'harian'|'mingguan'|'ad_hoc'
export type OpnameStatus = 'draft'|'finalized'
export type StokLevel = 'aman'|'menipis'|'kritis'|'unknown'

export interface BahanBaku {
  id: string; nama: string; satuan: Satuan; kategori: Kategori
  default_reorder_point: number; is_active: boolean; created_at: string
}
export interface Opname {
  id: string; outlet_id: string; tanggal: string; tipe: OpnameTipe
  status: OpnameStatus; created_by: string | null; created_at: string
  updated_at: string; notes: string | null
  outlet_staff?: { name: string } | null;
  opname_item?: {
    qty_fisik: number | null;
    qty_system: number;
    selisih: number;
    flagged: boolean;
  }[];
}
export interface OpnameItem {
  id: string; opname_id: string; bahan_baku_id: string
  qty_fisik: number | null; qty_system: number; selisih: number
  flagged: boolean; catatan: string | null
}
export interface LedgerStok {
  id: string; outlet_id: string; bahan_baku_id: string; tipe: LedgerTipe
  qty: number; catatan: string | null; ref_shipment_id: string | null
  ref_opname_id: string | null; ref_transfer_id: string | null
  created_by: string | null; created_at: string
  saldo_sebelum: number; saldo_sesudah: number
}
export interface StokBalance {
  id: string; outlet_id: string; bahan_baku_id: string
  saldo: number; updated_at: string
}
export interface ResepItem {
  id: string; resep_id: string; bahan_baku_id: string
  qty_per_porsi: number; satuan: string
}
