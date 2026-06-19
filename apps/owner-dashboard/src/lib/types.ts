export type SalesSource = 'pos' | 'online' | 'gofood' | 'grabfood' | 'shopeefood' | 'tiktok'

export interface SalesSummaryRow {
  outlet_id: string
  outlet_name: string
  sales_source: SalesSource
  sales_date: string            // 'YYYY-MM-DD'
  omzet: number
  jumlah_order_completed: number
  jumlah_order_all: number
}

export interface MenuSalesRow {
  outlet_id: string
  sales_source: SalesSource
  sales_date: string
  menu_key: string
  menu_name: string
  qty: number
  revenue: number
}

export interface PeriodFilterValue {
  from: string                  // 'YYYY-MM-DD' inklusif
  to: string                    // 'YYYY-MM-DD' inklusif
  outletId: string | 'all'
  source: SalesSource | 'all'
}
