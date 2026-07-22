'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { PeriodFilterValue, SalesSource, SalesSummaryRow, Outlet } from '@/lib/types'
import type { SalesHourlyRow } from '@/hooks/useSalesHourly'

export async function getOwnerDashboardData(filter: PeriodFilterValue, outlets: Outlet[]) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as any)
        })
      } catch {
        // SSR ignored
      }
    }
  })

  // 1. Fetch sales_hourly_scoped
  let q = supabase
    .from('sales_hourly_scoped')
    .select('outlet_id, sales_source, sales_date, sales_hour, omzet, jumlah_order_completed')
    .gte('sales_date', filter.from)
    .lte('sales_date', filter.to)

  if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
  if (filter.source !== 'all') q = q.eq('sales_source', filter.source)

  // 2. Fetch orders to calculate exact total_deductions (discount_amount + promo_subsidy)
  const fromStart = new Date(`${filter.from}T00:00:00.000Z`)
  const toEnd = new Date(`${filter.to}T23:59:59.999Z`)

  let ordersQ = supabase
    .from('orders')
    .select('outlet_id, created_at, discount_amount, promo_subsidy, channel, sales_source')
    .eq('status', 'completed')
    .gte('created_at', fromStart.toISOString())
    .lte('created_at', toEnd.toISOString())

  if (filter.outletId !== 'all') ordersQ = ordersQ.eq('outlet_id', filter.outletId)

  const [{ data, error }, { data: ordersData }] = await Promise.all([q, ordersQ])
  if (error) throw new Error(error.message)

  // Map deductions per `${outlet_id}|${sales_source}|${sales_date}`
  const deductionsMap = new Map<string, number>()
  for (const o of ordersData || []) {
    const d = new Date(o.created_at)
    // Convert UTC created_at to local date YYYY-MM-DD (Asia/Jakarta +7)
    const localDate = new Date(d.getTime() + 7 * 3600 * 1000)
    const dateStr = localDate.toISOString().split('T')[0]
    const src = (o.channel || o.sales_source || 'pos').toLowerCase()
    const key = `${o.outlet_id}|${src}|${dateStr}`
    const deduction = (Number(o.discount_amount) || 0) + (Number(o.promo_subsidy) || 0)
    deductionsMap.set(key, (deductionsMap.get(key) || 0) + deduction)
  }

  // Aggregate for Summary (KPI)
  const acc = new Map<string, SalesSummaryRow & { total_deductions?: number }>()
  for (const r of data || []) {
    const key = `${r.outlet_id}|${r.sales_source}|${r.sales_date}`
    const existing = acc.get(key)
    const deductionCell = deductionsMap.get(key) || 0

    if (existing) {
      existing.omzet += Number(r.omzet)
      existing.jumlah_order_completed += Number(r.jumlah_order_completed)
      existing.jumlah_order_all += Number(r.jumlah_order_completed)
      if ((existing as any).total_deductions !== undefined) {
        (existing as any).total_deductions += deductionCell
      }
    } else {
      acc.set(key, {
        outlet_id: r.outlet_id,
        outlet_name: '',
        sales_source: r.sales_source as SalesSource,
        sales_date: r.sales_date,
        omzet: Number(r.omzet),
        total_deductions: deductionCell,
        jumlah_order_completed: Number(r.jumlah_order_completed),
        jumlah_order_all: Number(r.jumlah_order_completed),
      })
    }
  }

  const summaryResult = Array.from(acc.values())
  const nameById = new Map(outlets.map((o) => [o.id, o.name]))
  const kpiRows = summaryResult.map((r) => ({
    ...r,
    outlet_name: nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
  }))

  // Aggregate for Hourly (Trend)
  const hourMap = new Map<number, SalesHourlyRow>()
  for (let i = 0; i < 24; i++) hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })
  for (const r of data || []) {
    const b = hourMap.get(r.sales_hour)
    if (!b) continue
    b.omzet += Number(r.omzet)
    b.jumlah_order_completed += Number(r.jumlah_order_completed)
  }
  const hourlyRows = Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour)

  return {
    kpiRows,
    hourlyRows,
  }
}
