import type { PromoDaySchedule } from '@/lib/promoSchedule'

export type MenuItem = {
  id: string
  name: string
  price: number
  image_url?: string | null
  outlet_id?: string | null
  is_package?: boolean | null
}

export type Outlet = {
  id: string
  name: string
}

export type OutletPromo = {
  id?: string
  outlet_id?: string
  scope: 'global' | 'item'
  menu_item_id: string | null
  discount_type: 'percentage' | 'nominal' | 'buy_one_get_one'
  discount_value: number
  is_active: boolean
  min_purchase?: number | null
  usage_limit?: number | null
  current_usage?: number
  quota_scope?: 'global' | 'per_outlet'
  quota_pool_id?: string | null
  start_date?: string | null
  end_date?: string | null
  daily_start_time?: string | null
  daily_end_time?: string | null
  daily_schedule?: PromoDaySchedule[] | null
  apply_to_food_apps?: boolean
  sync_to_order_online?: boolean
  promo_name?: string | null
  buy_quantity?: number
  get_quantity?: number
  reward_menu_item_id?: string | null
  /** Outlet yang dituju promo ini. Tidak diisi = semua outlet aktif (perilaku lama). */
  outlet_ids?: string[]
  /** Menu yang dikecualikan dari promo global. Kosong = semua menu ikut. Hanya scope global. */
  excluded_menu_item_ids?: string[] | null
}

export type PromoField = keyof OutletPromo
