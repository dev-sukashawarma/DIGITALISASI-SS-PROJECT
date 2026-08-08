'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { SalesSummaryRow, PeriodFilterValue, SalesSource } from '@/lib/types'

// Ringkasan harian per outlet × sumber langsung dari view DB `sales_daily_scoped`.
// Untuk halaman yang HANYA butuh agregat harian (mis. Profit) — rentang lebar
// tak perlu mengirim baris per-jam ke browser. Return shape sama dengan
// useSalesSummary agar konsumen tak berubah.
export function useSalesDaily(filter: PeriodFilterValue, outlets?: { id: string; name: string }[]) {
  const supabase = createClient()
  const query = useQuery<SalesSummaryRow[]>({
    queryKey: ['sales-daily', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      // Fetch orders for aggregations and deductions
      const fromStart = new Date(`${filter.from}T00:00:00.000+07:00`)
      const toEnd = new Date(`${filter.to}T23:59:59.999+07:00`)
      
      let ordersQ = supabase
        .from('orders')
        .select('outlet_id, created_at, discount_amount, promo_subsidy, channel, sales_source, is_endorse, total_amount, order_items(subtotal)')
        .eq('status', 'completed')
        .gte('created_at', fromStart.toISOString())
        .lte('created_at', toEnd.toISOString())
        
      if (filter.outletId !== 'all') ordersQ = ordersQ.eq('outlet_id', filter.outletId)
      
      const { data: ordersData, error: ordersErr } = await ordersQ
      if (ordersErr) throw ordersErr
      
      const aggMap = new Map<string, any>()
      for (const o of ordersData || []) {
        const d = new Date(o.created_at)
        const localDate = new Date(d.getTime() + 7 * 3600 * 1000)
        const dateStr = localDate.toISOString().split('T')[0]
        
        const srcKey = (o.is_endorse ? 'endors' : (o.sales_source || 'pos')).toLowerCase()
        
        if (filter.source !== 'all' && srcKey !== filter.source.toLowerCase()) continue;
        
        const key = `${o.outlet_id}|${srcKey}|${dateStr}`
        
        let discount = 0
        const disc = Number(o.discount_amount) || 0
        const promo = Number(o.promo_subsidy) || 0
        if (disc > 0 || promo > 0) {
          discount = disc + promo
        } else {
          const itemSubtotal = (o.order_items || []).reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0)
          const totalAmt = Number(o.total_amount) || 0
          discount = itemSubtotal > totalAmt ? itemSubtotal - totalAmt : 0
        }
        
        let platformFee = 0 
        
        const existing = aggMap.get(key) || { 
          outlet_id: o.outlet_id,
          outlet_name: '',
          sales_source: srcKey as SalesSource,
          sales_date: dateStr,
          omzet: 0,
          jumlah_order_completed: 0,
          jumlah_order_all: 0,
          total_deductions: 0,
          platform_fee: 0
        }
        
        existing.omzet += Number(o.total_amount || 0)
        existing.jumlah_order_completed += 1
        existing.jumlah_order_all += 1
        existing.total_deductions += discount
        existing.platform_fee += platformFee
        
        aggMap.set(key, existing)
      }

      return Array.from(aggMap.values())
    },
  })

  // Resolusi nama outlet dari daftar yang sudah dimuat caller (useOutlets()).
  const rows = useMemo<SalesSummaryRow[]>(() => {
    const base = query.data ?? []
    if (!outlets || outlets.length === 0) return base
    const nameById = new Map(outlets.map((o) => [o.id, o.name]))
    return base.map((r) => ({
      ...r,
      outlet_name: nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
    }))
  }, [query.data, outlets])

  return { rows, loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
