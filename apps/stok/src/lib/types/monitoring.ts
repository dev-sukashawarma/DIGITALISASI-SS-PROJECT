export type StockStatus = 'below' | 'warning' | 'ok';

export interface MonitoringItem {
  outlet_id: string;
  outlet_name: string;
  bahan_baku_id: string;
  item_name: string;
  satuan: string;
  satuan_kecil: string | null;
  satuan_tengah: string | null;
  faktor_tampilan: number | null;
  faktor_tengah: number | null;
  kategori: string;
  kategori_core: string | null;
  current_qty: number;
  // true kalau tulisan TERAKHIR ke baris ini adalah opname_selisih (form
  // dinamis, sejak 2026-08-01 20:32 WIB) -- artinya current_qty sudah pasti
  // dalam satuan kecil (gram), bukan satuan besar. Dipakai
  // formatTriUnitSaldoAdaptive/formatCompositeSaldoAdaptive untuk memilih
  // arah dekomposisi yang benar. Lihat migration
  // 20300105000003_saldo_is_gram_and_last_opname_date.sql.
  saldo_is_gram: boolean;
  threshold: number;
  status: StockStatus;
  is_flagged: boolean;
  last_updated: string;
  last_opname_date: string | null;
}

export interface SPVMonitoringData {
  items: MonitoringItem[];
  lastFetched: string;
}

export interface CrewMonitoringData {
  outlet_id: string;
  outlet_name: string;
  items: Omit<MonitoringItem, 'outlet_id' | 'outlet_name'>[];
  summary: {
    below_threshold: number;
    flagged: number;
    ok: number;
    total: number;
  };
  lastFetched: string;
}

export interface OpnameStatus {
  outlet_id: string;
  outlet_name: string;
  last_opname_date: string | null;
  days_since: number;
  is_overdue: boolean;
}

export interface DetailItem extends MonitoringItem {
  // Satuan kecil untuk tampilan majemuk saldo (mis. liter untuk kompan). Independen dari faktor_konversi (BOM/resep).
  satuan_kecil: string | null;
  satuan_tengah: string | null;
  faktor_tampilan: number | null;
  faktor_tengah: number | null;
  recent_ledger: {
    type: string;
    qty: number;
    notes: string;
    created_at: string;
  }[];
  discrepancy_details?: {
    type: 'qty_mismatch' | 'damaged' | 'lost';
    qty_system: number;
    qty_fisik: number;
    catatan: string;
    foto_path?: string;
  };
}
