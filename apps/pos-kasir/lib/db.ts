import Dexie, { type EntityTable } from 'dexie';

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

class SukaPOSDB extends Dexie {
  menu_items!: EntityTable<MenuItemCache, 'id'>;
  categories!: EntityTable<CategoryCache, 'id'>;
  sync_queue_orders!: EntityTable<SyncQueueOrder, 'id'>;
  kiosk_settings!: EntityTable<KioskSettingsCache, 'id'>;

  constructor() {
    super('SukaPOSDatabase');
    this.version(1).stores({
      menu_items: 'id, category, is_available',
      categories: 'id, sort_order',
      sync_queue_orders: 'id, status, created_at',
      kiosk_settings: 'id'
    });
  }
}

export const db = new SukaPOSDB();
