import Dexie, { type EntityTable } from 'dexie';
import type { OrderWithItems } from '@/types';

export interface MenuItemCache {
  id: string;
  name: string;
  price: number;
  category: string;
  is_available: boolean;
  image_url?: string;
  sort_order?: number;
  synced_at: number;
}

export interface CategoryCache {
  id: string;
  name: string;
  sort_order: number;
  synced_at: number;
}

export interface SyncQueueOrder {
  id: string;
  payload: any;
  status: 'pending' | 'error';
  created_at: number;
  error_message?: string;
  attempts?: number;
  next_attempt_at?: number;
  // Menghubungkan antrean ke pesanan lokal (local_orders) agar bisa
  // di-remap ke id server setelah sinkron sukses.
  local_order_id?: string;
  // Legacy (build lama): ringkasan tampilan antrean. Dipertahankan agar entri
  // yang dibuat build sebelumnya tetap valid saat di-sync.
  displayData?: {
    orderNumber: string;
    totalAmount: number;
    paymentMethod?: string;
    source: string;
    items: Array<{
      id: string;
      menu_item_name: string;
      quantity: number;
      note?: string;
    }>;
  };
}

export interface KioskSettingsCache {
  id: string;
  settings_data: any;
  synced_at: number;
}

// Cache pesanan hari ini per outlet — sumber data papan order saat offline.
export interface OrderCacheRow {
  id: string;
  outlet_id: string;
  status: string;
  created_at: string; // ISO, dari server
  data: OrderWithItems;
  synced_at: number;
}

export interface ShiftCache {
  id: string;
  shift_data: any;
  synced_at: number;
}

// Pesanan yang DIBUAT saat offline. Tampil di papan order dengan badge offline
// dan dihapus setelah berhasil dikirim ke server.
export interface LocalOrderRow {
  id: string; // = client_order_id, sekaligus kunci idempotensi ke server
  outlet_id: string;
  order_number: number; // nomor PERKIRAAN; final ditetapkan server saat sinkron
  is_estimated_number?: boolean;
  status: string;
  created_at: string; // ISO
  data: OrderWithItems;
  sync_error?: string;
  needs_attention?: number; // 1 = gagal permanen, tunggu tindakan kasir
}

// Antrean perubahan status pesanan (Mulai Masak / Selesai / Batal) saat offline.
export interface SyncQueueMutation {
  id: string;
  order_id: string; // id server ATAU id lokal (di-remap saat order tersinkron)
  is_local: number; // 1 = order_id masih id lokal, 0 = id server (indexable)
  patch: Record<string, any>;
  status: 'pending' | 'error';
  created_at: number;
  error_message?: string;
}

// Key-value umum: profil outlet kasir, promo per outlet, counter nomor lokal.
export interface AppStateRow {
  key: string;
  value: any;
  synced_at: number;
}

class SukaPOSDB extends Dexie {
  menu_items!: EntityTable<MenuItemCache, 'id'>;
  categories!: EntityTable<CategoryCache, 'id'>;
  sync_queue_orders!: EntityTable<SyncQueueOrder, 'id'>;
  kiosk_settings!: EntityTable<KioskSettingsCache, 'id'>;
  orders_cache!: EntityTable<OrderCacheRow, 'id'>;
  shifts_cache!: EntityTable<ShiftCache, 'id'>;
  local_orders!: EntityTable<LocalOrderRow, 'id'>;
  sync_queue_mutations!: EntityTable<SyncQueueMutation, 'id'>;
  app_state!: EntityTable<AppStateRow, 'key'>;

  constructor() {
    super('SukaPOSDatabase');
    this.version(1).stores({
      menu_items: 'id, category, is_available',
      categories: 'id, sort_order',
      sync_queue_orders: 'id, status, created_at',
      kiosk_settings: 'id'
    });
    // v2 (build lama): orders_cache tanpa index outlet, plus shifts_cache
    this.version(2).stores({
      menu_items: 'id, category, is_available',
      categories: 'id, sort_order',
      sync_queue_orders: 'id, status, created_at',
      kiosk_settings: 'id',
      orders_cache: 'id',
      shifts_cache: 'id'
    });
    // v3: skema offline penuh — orders_cache ter-index per outlet, order lokal,
    // antrean mutasi status, dan app_state (profil outlet/promo/counter).
    this.version(3).stores({
      menu_items: 'id, category, is_available',
      categories: 'id, sort_order',
      sync_queue_orders: 'id, status, created_at',
      kiosk_settings: 'id',
      orders_cache: 'id, outlet_id, status, created_at',
      shifts_cache: 'id',
      local_orders: 'id, outlet_id, status, created_at',
      sync_queue_mutations: 'id, order_id, status, is_local, created_at',
      app_state: 'key'
    }).upgrade((tx) => {
      // Bentuk row orders_cache berubah (order_data → data + kolom ter-index);
      // buang cache lama agar tidak tercampur — akan terisi ulang saat online.
      return tx.table('orders_cache').clear();
    });

    // v4: index tambahan untuk backoff antrean & daftar "Perlu Perhatian".
    this.version(4).stores({
      menu_items: 'id, category, is_available',
      categories: 'id, sort_order',
      sync_queue_orders: 'id, status, created_at, next_attempt_at',
      kiosk_settings: 'id',
      orders_cache: 'id, outlet_id, status, created_at',
      shifts_cache: 'id',
      local_orders: 'id, outlet_id, status, created_at, needs_attention',
      sync_queue_mutations: 'id, order_id, status, is_local, created_at',
      app_state: 'key'
    });
  }
}

export const db = new SukaPOSDB();
