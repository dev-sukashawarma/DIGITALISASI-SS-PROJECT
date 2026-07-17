export type MutasiStatus = 
  | 'menunggu_persetujuan'
  | 'ditolak'
  | 'menunggu_pengiriman'
  | 'dikirim'
  | 'selesai';

export interface MutasiKurirInfo {
  provider: string;
  tracking_url?: string;
  driver_name?: string;
  resi?: string;
  ongkos?: number;
}

export interface MutasiAntarOutlet {
  id: string;
  outlet_asal_id: string;
  outlet_tujuan_id: string;
  status: MutasiStatus;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  received_by?: string;
  received_at?: string;
  kurir_info?: MutasiKurirInfo;
  catatan_pengajuan?: string;
  catatan_penolakan?: string;
  created_at: string;
  updated_at: string;
  
  // Joined relations
  outlet_asal?: { nama: string };
  outlet_tujuan?: { nama: string };
  creator?: { name: string };
  approver?: { name: string };
  receiver?: { name: string };
  items?: MutasiAntarOutletItem[];
}

export interface MutasiAntarOutletItem {
  id: string;
  mutasi_id: string;
  bahan_baku_id: string;
  qty_diajukan: number;
  qty_dikirim?: number;
  qty_diterima?: number;
  kondisi_diterima?: 'baik' | 'rusak' | 'hilang_qty';
  foto_bukti_terima?: string;
  
  // Joined relation
  bahan_baku?: { nama: string; satuan: string };
}
