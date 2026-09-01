import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import AdminOverviewView from './AdminOverviewView'
import { resolveRange } from '@/lib/admin-analytics'
import type { Outlet } from '@/pos-types'
import { fetchAllPages } from '@/lib/fetchAllPages'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Kedua query di bawah jauh melampaui batas 1.000 baris PostgREST:
  // `orders` 30 hari + periode pembanding ≈ 60.000 baris, dan `sales_hourly_spv`
  // ≈ 8.000 baris. Tanpa paginasi keduanya terpotong diam-diam (HTTP 200, tanpa
  // error), sehingga KPI Ringkasan POS tampil jauh lebih kecil dari semestinya.
  // `.order()` disertakan sebagai urutan deterministik — syarat paginasi aman.
  const dateRange = resolveRange('30days', '', '')
  const chartFrom = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  })()

  const buildOrdersQuery = () => {
    let q = supabase
      .from('orders')
      .select('id, status, total_amount, created_at, outlet_id, channel, sales_source, scheduled_promo_names')
      .eq('status', 'completed')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    const lowerBound = dateRange.prevStart ?? dateRange.start
    if (lowerBound) q = q.gte('created_at', lowerBound.toISOString())
    if (dateRange.end) q = q.lte('created_at', dateRange.end.toISOString())
    return q
  }

  const buildChartQuery = () => supabase
    .from('sales_hourly_spv')
    .select('sales_date, omzet')
    .gte('sales_date', chartFrom)
    // `sales_source` wajib ikut: tanpa itu 8.304 baris hanya punya 4.991
    // kombinasi unik, sehingga paginasi bisa menggandakan/melewatkan baris.
    .order('sales_date', { ascending: true })
    .order('outlet_id', { ascending: true })
    .order('sales_hour', { ascending: true })
    .order('sales_source', { ascending: true })

  const [outletsRes, orders, chartDaily] = await Promise.all([
    supabase.from('outlets').select('*').order('name'),
    fetchAllPages<any>(buildOrdersQuery),
    fetchAllPages<any>(buildChartQuery),
  ])

  return (
    <AdminOverviewView
      initialOutlets={(outletsRes.data as Outlet[]) ?? []}
      initialOrders={orders}
      initialChartDaily={chartDaily}
    />
  )
}
