export interface Outlet {
  id: string
  name: string
  address: string | null
  phone?: string | null
  type?: string
  open_hour?: string
  close_hour?: string
  is_active: boolean
  inactive_reason?: string | null
  created_at?: string
  updated_at?: string
}

export interface SalesChannel {
  id: string
  name: string
  is_active: boolean
  created_at?: string
}

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
  description?: string | null
  price: number
  strike_price?: number | null
  channel_prices?: Record<string, number>
  channel_hpp?: Record<string, number>
  hpp_override?: number | null
  image_url?: string | null
  is_available: boolean
  is_available_online: boolean
  is_published_order_online?: boolean
  available_online_channels?: string[] | null
  campaign_price?: number | null
  is_campaign_active?: boolean
  sort_order: number
  is_package?: boolean
  package_items?: PackageItem[]
  categories?: Category
}

export interface MenuOutletPrice {
  id?: string
  menu_item_id: string
  outlet_id: string
  price: number | null
  hpp_override: number | null
  is_available: boolean
  created_at?: string
  updated_at?: string
}

