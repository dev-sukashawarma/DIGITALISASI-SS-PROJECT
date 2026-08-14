import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import AdminOverviewView from './AdminOverviewView'
import { resolveRange } from '@/lib/admin-analytics'
import type { Outlet } from '@/pos-types'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const [outletsRes, ordersRes, chartRes] = await Promise.all([
    supabase.from('outlets').select('*').order('name'),
    (async () => {
      const dateRange = resolveRange('30days', '', '')
      let q = supabase
        .from('orders')
        .select('id, status, total_amount, created_at, outlet_id, channel, sales_source, scheduled_promo_names')
        .eq('status', 'completed')
        .order('created_at', { ascending: true })

      const lowerBound = dateRange.prevStart ?? dateRange.start
      if (lowerBound) q = q.gte('created_at', lowerBound.toISOString())
      if (dateRange.end) q = q.lte('created_at', dateRange.end.toISOString())
      return q
    })(),
    (async () => {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      const fmt = (date: Date) => {
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${date.getFullYear()}-${m}-${day}`
      }
      return supabase
        .from('sales_hourly_spv')
        .select('sales_date, omzet')
        .gte('sales_date', fmt(d))
        .order('sales_date', { ascending: true })
    })()
  ])

  return (
    <AdminOverviewView 
      initialOutlets={(outletsRes.data as Outlet[]) ?? []}
      initialOrders={(ordersRes.data as any[]) ?? []}
      initialChartDaily={(chartRes.data as any[]) ?? []}
    />
  )
}
