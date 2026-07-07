import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { presetRange, previousRange } from '@/lib/period'
import OwnerDashboardView from './OwnerDashboardView'
import type { SalesSource } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function OwnerDashboardPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })
  
  const queryClient = new QueryClient()
  
  // 1. Fetch Outlets
  const { data: outlets } = await supabase
    .from('outlets')
    .select('id, slug, name, address, lat, lng, type, is_active')
    .order('name')
  
  if (outlets) {
    queryClient.setQueryData(['outlets'], outlets)
  }

  const filter = { ...presetRange('today'), outletId: 'all', source: 'all' as SalesSource }
  const prevFilter = { ...filter, ...previousRange({ from: filter.from, to: filter.to }) }
  
  // 2. Fetch Sales Hourly Raw (Current)
  const { data: curSales } = await supabase
    .from('sales_hourly_scoped')
    .select('outlet_id, sales_source, sales_date, sales_hour, omzet, jumlah_order_completed')
    .gte('sales_date', filter.from)
    .lte('sales_date', filter.to)
    
  if (curSales) {
    queryClient.setQueryData(
      ['sales-hourly-raw', filter.from, filter.to, filter.outletId, filter.source], 
      curSales.map((r: any) => ({
        outlet_id: r.outlet_id,
        sales_source: r.sales_source,
        sales_date: r.sales_date,
        sales_hour: r.sales_hour,
        omzet: Number(r.omzet),
        jumlah_order_completed: Number(r.jumlah_order_completed),
      }))
    )
  }
  
  // 3. Fetch Sales Hourly Raw (Previous)
  const { data: prevSales } = await supabase
    .from('sales_hourly_scoped')
    .select('outlet_id, sales_source, sales_date, sales_hour, omzet, jumlah_order_completed')
    .gte('sales_date', prevFilter.from)
    .lte('sales_date', prevFilter.to)
    
  if (prevSales) {
    queryClient.setQueryData(
      ['sales-hourly-raw', prevFilter.from, prevFilter.to, prevFilter.outletId, prevFilter.source], 
      prevSales.map((r: any) => ({
        outlet_id: r.outlet_id,
        sales_source: r.sales_source,
        sales_date: r.sales_date,
        sales_hour: r.sales_hour,
        omzet: Number(r.omzet),
        jumlah_order_completed: Number(r.jumlah_order_completed),
      }))
    )
  }
  
  // 4. Fetch Menu Sales Raw
  const { data: menuSales } = await supabase
    .from('menu_sales_scoped')
    .select('outlet_id, sales_source, sales_date, menu, qty, omzet')
    .gte('sales_date', filter.from)
    .lte('sales_date', filter.to)
    
  if (menuSales) {
    queryClient.setQueryData(
      ['menu-sales-raw', filter.from, filter.to, filter.outletId, filter.source], 
      menuSales.map((r: any) => ({
        outlet_id: r.outlet_id,
        sales_source: r.sales_source,
        sales_date: r.sales_date,
        menu: r.menu,
        qty: Number(r.qty),
        omzet: Number(r.omzet),
      }))
    )
  }
  
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OwnerDashboardView />
    </HydrationBoundary>
  )
}
