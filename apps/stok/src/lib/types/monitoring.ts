export type StockStatus = 'below' | 'warning' | 'ok';

export interface MonitoringItem {
  outlet_id: string;
  outlet_name: string;
  bahan_baku_id: string;
  item_name: string;
  satuan: string;
  kategori: string;
  current_qty: number;
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
