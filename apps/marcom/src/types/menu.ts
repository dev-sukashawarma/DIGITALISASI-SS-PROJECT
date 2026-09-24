export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface PackageItem {
  id: string
  package_id: string
  menu_item_id: string
  or_menu_item_id?: string | null
  quantity: number
  menu_item?: MenuItem
  or_menu_item?: MenuItem
}

export interface MenuItem {
  id: string
  category_id: string | null
  outlet_id: string | null
  name: string
  description: string | null
  price: number
  strike_price?: number | null
  channel_prices?: Record<string, number | string> | null
  image_url: string | null
  is_available: boolean
  is_available_online?: boolean
  is_published_order_online?: boolean
  tampil_di_app?: boolean
  order_online_sync_status?: 'not_published' | 'pending' | 'synced' | 'failed'
  order_online_sync_error?: string | null
  order_online_sync_updated_at?: string | null
  available_online_channels?: string[] | null
  campaign_price?: number | null
  is_campaign_active?: boolean
  sort_order: number
  is_package?: boolean
  package_items?: PackageItem[]
  categories?: Category
  available_outlets?: string[] | null
}

export interface SalesChannel {
  id: string
  name: string
  is_active: boolean
  sort_order?: number
}

export interface Outlet {
  id: string
  name: string
  address: string | null
  phone: string | null
  type?: string
  is_active: boolean
}

export interface MenuPromo {
  scope: 'global' | 'item'
  menu_item_id: string | null
  outlet_id?: string | null
  is_active: boolean
  start_date?: string | null
  end_date?: string | null
  daily_start_time?: string | null
  daily_end_time?: string | null
  daily_schedule?: Array<{ date: string; start_time: string; end_time: string }> | null
}
