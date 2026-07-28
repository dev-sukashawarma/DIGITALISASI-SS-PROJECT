export type Satuan = 'kg'|'gram'|'liter'|'ml'|'pcs'|'box'|'pack'|'ikat'|'botol'|'crt'|'kompan'|'blok'
export type SatuanKecil = 'liter'|'ml'|'gram'|'cm'|'lembar'
export type Kategori = 'protein'|'sayur'|'bumbu'|'saus'|'roti'|'kemasan'|'minuman'|'lainnya'
export type LedgerTipe =
  | 'terima_kiriman' | 'pemakaian' | 'waste' | 'adjustment'
  | 'opname_selisih' | 'transfer_keluar' | 'transfer_masuk' | 'waste_pending'
export type OpnameTipe = 'harian'|'mingguan'|'ad_hoc'
export type OpnameStatus = 'draft'|'pending_approval'|'finalized'|'rejected'
export type StokLevel = 'aman'|'menipis'|'kritis'|'unknown'

export interface BahanBaku {
  id: string; nama: string; satuan: Satuan; kategori: Kategori
  default_reorder_point: number; is_active: boolean; created_at: string
  faktor_konversi: number
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: SatuanKecil | null
  faktor_tampilan: number | null
  satuan_distribusi?: string | null
}
export interface Opname {
  id: string; outlet_id: string; tanggal: string; tipe: OpnameTipe
  status: OpnameStatus; created_by: string | null; created_at: string
  updated_at: string; notes: string | null
  // Approval fields (added via migration)
  approved_by: string | null; approved_at: string | null
  approval_notes: string | null
  outlet_staff?: { name: string } | null;
  approved_by_staff?: { name: string } | null;
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
  ref_opname_id: string | null; ref_transfer_id: string | null; ref_order_id: string | null
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

export interface LedgerTransaksiSummary {
  transaksi_key: string
  outlet_id: string
  created_at: string
  jumlah_bahan: number
  ref_order_id: string | null
  ref_opname_id: string | null
  ref_shipment_id: string | null
  ref_transfer_id: string | null
  single_bahan_baku_id: string | null
  single_tipe: LedgerTipe | null
  single_qty: number | null
  single_catatan: string | null
  single_saldo_sesudah: number | null
  order_number?: number | null
  order_items_names?: string | null
  opname_tanggal?: string | null
  opname_tipe?: OpnameTipe | null
}

export interface LedgerTransaksiDetailRow {
  id: string
  tipe: LedgerTipe
  qty: number
  catatan: string | null
  saldo_sebelum: number
  saldo_sesudah: number
  created_at: string
  bahan_baku: { nama: string; satuan: Satuan; satuan_tengah: string | null; faktor_tengah: number | null; satuan_kecil: SatuanKecil | null; faktor_tampilan: number | null } | null
}

export type WasteStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export interface WasteReport {
  id: string; outlet_id: string; bahan_baku_id: string
  qty: number; reason: string; photo_url: string | null
  status: WasteStatus; rejection_reason: string | null
  reported_by: string | null; approved_by: string | null
  created_at: string; updated_at: string
  bahan_baku?: { 
    nama: string; 
    satuan: string;
    satuan_tengah?: string | null;
    faktor_tengah?: number | null;
    satuan_kecil?: string | null;
    faktor_tampilan?: number | null;
  } | null
}
