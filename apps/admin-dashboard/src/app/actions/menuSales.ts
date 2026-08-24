'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { PeriodFilterValue } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

export type AggregatedMenuSales = {
  name: string
  qty: number
  revenue: number
}

export async function getAggregatedMenuSales(filter: PeriodFilterValue): Promise<AggregatedMenuSales[]> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as any)
        })
      } catch {
        // Ignored if called during SSR
      }
    }
  })
  
  let q = supabase
    .from('menu_sales_scoped')
    .select('outlet_id, menu_name, qty, revenue')
    .neq('outlet_id', TEST_OUTLET_ID)
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
    if (isTestOutlet(r.outlet_id)) continue
    const cleanName = (r.menu_name || 'Unknown Menu').split('|')[0].trim()
    const cur = agg.get(cleanName) ?? { name: cleanName, qty: 0, revenue: 0 }
    cur.qty += Number(r.qty || 0)
    cur.revenue += Number(r.revenue || 0)
    agg.set(cleanName, cur)
  }
  
  return Array.from(agg.values())
}
