'use server'

import { createSupabaseServerClient } from '@suka/auth'
import type { PeriodFilterValue } from '@/lib/types'

export type AggregatedMenuSales = {
  name: string
  qty: number
  revenue: number
}

export async function getAggregatedMenuSales(filter: PeriodFilterValue): Promise<AggregatedMenuSales[]> {
  const supabase = createSupabaseServerClient()
  
  let q = supabase
    .from('menu_sales_scoped')
    .select('menu_name, qty, revenue')
    .gte('sales_date', filter.from)
    .lte('sales_date', filter.to)
    
  if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
  if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
  
  const { data, error } = await q
  
  if (error) {
    throw new Error(error.message)
  }
  
  const agg = new Map<string, AggregatedMenuSales>()
  for (const r of data || []) {
    const cleanName = r.menu_name.split('|')[0].trim()
    const cur = agg.get(cleanName) ?? { name: cleanName, qty: 0, revenue: 0 }
    cur.qty += Number(r.qty || 0)
    cur.revenue += Number(r.revenue || 0)
    agg.set(cleanName, cur)
  }
  
  return Array.from(agg.values())
}
