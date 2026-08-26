// @ts-nocheck
'use server'

import { cookies } from 'next/headers'
import { db } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@suka/auth'
import type { PeriodFilterValue, SalesSource, SalesSummaryRow, Outlet } from '@/lib/types'
import type { SalesHourlyRow } from '@/hooks/useSalesHourly'
import type { PettyCashTransaction, DailyPettyCashSummary } from '@/components/owner/PettyCashReportView'
import type { AttendanceRecordExt } from '@/components/owner/AttendanceReportView'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

function cleanItemName(name: string) {
  if (!name) return ''
  return name.trim()
}

async function fetchEcommerceOwnerData(
  supabase: any,
  fromStart: Date,
  toEnd: Date,
  sourceFilter: SalesSource = 'all'
) {
  const PAGE_SIZE = 1000
  let offset = 0
  const allEc: any[] = []

  while (true) {
    const { data, error } = await supabase
      .from('ecommerce_sales')
      .select('id, channel_id, order_id, order_date, total_amount, raw_data, ecommerce_sale_items(id, quantity, price, subtotal, menu_id, menu_items:menu_id(name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp)))))')
      .gte('order_date', fromStart.toISOString())
      .lte('order_date', toEnd.toISOString())
      .order('order_date', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('fetchEcommerceOwnerData error:', error)
      break
    }
    const page = data ?? []
    allEc.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const kpiMap = new Map<string, SalesSummaryRow & { total_deductions?: number }>()
  const hourMap = new Map<number, SalesHourlyRow>()
  for (let i = 0; i < 24; i++) {
    hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })
  }
  const menuMap = new Map<string, { name: string; qty: number; revenue: number }>()
  let totalCogs = 0

  for (const ec of allEc) {
    const raw = ec.raw_data || {}
    const totalPotongan = Math.abs(Number(raw.total_potongan || raw.admin_fee || raw.discount_amount) || 0)
    const omzetKotor = Number(ec.total_amount) || 0
    const omzetNet = Math.max(0, omzetKotor - totalPotongan)

    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(ec.order_date))
    const hourStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date(ec.order_date))
    const hour = parseInt(hourStr, 10) || 0

    const chNorm = (ec.channel_id || '').toLowerCase()
    let salesSource: SalesSource = 'online'
    if (chNorm.includes('tiktok') || chNorm === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5') {
      salesSource = 'tiktok_shop' as SalesSource
    } else if (chNorm.includes('shopee') || chNorm === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584') {
      salesSource = 'shopee_shop' as SalesSource
    }

    if (sourceFilter !== 'all') {
      const sf = sourceFilter.toLowerCase()
      if (sf === 'pos') continue
      if (sf.includes('tiktok') && salesSource !== 'tiktok_shop') continue
      if (sf.includes('shopee') && salesSource !== 'shopee_shop') continue
    }

    const kpiKey = `ss-online|${salesSource}|${dateStr}`
    const existingKpi = kpiMap.get(kpiKey) || {
      outlet_id: 'ss-online',
      outlet_name: 'SS ONLINE',
      sales_source: salesSource,
      sales_date: dateStr,
      omzet: 0,
      jumlah_order_completed: 0,
      jumlah_order_all: 0,
      total_deductions: 0
    }
    existingKpi.omzet += omzetNet
    existingKpi.jumlah_order_completed += 1
    existingKpi.jumlah_order_all += 1
    existingKpi.total_deductions = (existingKpi.total_deductions || 0) + totalPotongan
    kpiMap.set(kpiKey, existingKpi)

    const curHour = hourMap.get(hour) || { sales_hour: hour, omzet: 0, jumlah_order_completed: 0 }
    curHour.omzet += omzetNet
    curHour.jumlah_order_completed += 1
    hourMap.set(hour, curHour)

    for (const item of (ec.ecommerce_sale_items || [])) {
      const menuName = item.menu_items?.name || 'Unknown Menu'
      const cleanName = cleanItemName(menuName) || menuName
      const qty = Number(item.quantity) || 0
      const revenue = Number(item.subtotal) || (Number(item.price) * qty) || 0

      const curMenu = menuMap.get(cleanName) || { name: cleanName, qty: 0, revenue: 0 }
      curMenu.qty += qty
      curMenu.revenue += revenue
      menuMap.set(cleanName, curMenu)

      const mi = item.menu_items
      let itemHpp = 0
      if (mi) {
        let channelHppVal: number | null = null
        if (mi.channel_hpp && typeof mi.channel_hpp === 'object') {
          channelHppVal = mi.channel_hpp.ss_online ?? mi.channel_hpp.tiktok_shop ?? mi.channel_hpp.shopee_shop ?? mi.channel_hpp[chNorm] ?? null
        }
        if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
          itemHpp = Number(channelHppVal)
        } else if (mi.hpp_override !== null && mi.hpp_override !== undefined && Number(mi.hpp_override) > 0) {
          itemHpp = Number(mi.hpp_override)
        } else if (mi.is_package && Array.isArray(mi.package_items)) {
          itemHpp = mi.package_items.reduce((sum: number, pkg: any) => {
            const compHpp = Number(pkg.component?.hpp_override || 0)
            const pQty = Number(pkg.quantity || 1)
            return sum + compHpp * pQty
          }, 0)
        }
      }
      totalCogs += qty * itemHpp
    }
  }

  return {
    kpiRows: Array.from(kpiMap.values()),
    hourlyRows: Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour),
    menuRows: Array.from(menuMap.values()),
    totalCogs,
    totalOpex: 0,
  }
}

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

  // Fetch all completed orders with pagination
  // Fix: filter.from/to is YYYY-MM-DD. Use +07:00 timezone to get exactly 00:00 to 23:59 local time.
  const fromStart = new Date(`${filter.from}T00:00:00.000+07:00`)
  const toEnd = new Date(`${filter.to}T23:59:59.999+07:00`)

  if (filter.outletId === 'ss-online') {
    const ecData = await fetchEcommerceOwnerData(supabase, fromStart, toEnd, filter.source)
    return {
      ...ecData,
      totalCogsOpex: ecData.totalCogs + ecData.totalOpex,
    }
  }

  let ordersQ = supabase
    .from('orders')
    .select('outlet_id, created_at, discount_amount, promo_subsidy, channel, sales_source, is_endorse, total_amount, order_items(subtotal, quantity, menu_items(hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))))')
    .neq('outlet_id', TEST_OUTLET_ID)
    .eq('status', 'completed')
    .gte('created_at', fromStart.toISOString())
    .lte('created_at', toEnd.toISOString())

  if (filter.outletId !== 'all') ordersQ = ordersQ.eq('outlet_id', filter.outletId)

  // Query expenses & petty cash expenses for OPEX calculation
  let expQ = supabase
    .from('expenses')
    .select('amount, outlet_id')
    .neq('outlet_id', TEST_OUTLET_ID)
    .gte('expense_date', filter.from)
    .lte('expense_date', filter.to)

  let pettyQ = supabase
    .from('petty_cash_expenses')
    .select('amount, outlet_id')
    .neq('outlet_id', TEST_OUTLET_ID)
    .gte('expense_date', filter.from)
    .lte('expense_date', filter.to)

  if (filter.outletId !== 'all') {
    expQ = expQ.eq('outlet_id', filter.outletId)
    pettyQ = pettyQ.eq('outlet_id', filter.outletId)
  }

  const PAGE_SIZE = 1000
  const allOrders: any[] = []
  let offset = 0
  while (true) {
    const { data: page, error } = await ordersQ.range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    if (!page || page.length === 0) break
    allOrders.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const isAll = filter.outletId === 'all'
  const ecPromise = isAll ? fetchEcommerceOwnerData(supabase, fromStart, toEnd, filter.source) : Promise.resolve(null)

  const [{ data: expData }, { data: pettyData }, ecData] = await Promise.all([
    expQ,
    pettyQ,
    ecPromise
  ])

  const totalExpensesMonthly = (expData || [])
    .filter((e: any) => !isTestOutlet(e.outlet_id))
    .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0)

  const totalExpensesPetty = (pettyData || [])
    .filter((e: any) => !isTestOutlet(e.outlet_id))
    .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0)

  let totalOpex = totalExpensesMonthly + totalExpensesPetty

  const outletTypeMap = new Map(outlets.map((o) => [o.id, o.type || 'outlet']))
  let totalCogs = 0
  const acc = new Map<string, SalesSummaryRow & { total_deductions?: number }>()
  const hourMap = new Map<number, SalesHourlyRow>()
  for (let i = 0; i < 24; i++) hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })

  for (const o of allOrders) {
    if (isTestOutlet(o.outlet_id)) continue

    const d = new Date(o.created_at)
    const localDate = new Date(d.getTime() + 7 * 3600 * 1000)
    const dateStr = localDate.toISOString().split('T')[0]
    const hour = localDate.getUTCHours()

    const srcKey = (o.is_endorse ? 'endors' : (o.sales_source || 'pos')).toLowerCase() as SalesSource
    if (filter.source !== 'all' && srcKey !== filter.source.toLowerCase()) continue

    const totalAmt = Number(o.total_amount || 0)
    const disc = Number(o.discount_amount) || 0
    const promo = Number(o.promo_subsidy) || 0
    let deduction = 0
    if (disc > 0 || promo > 0) {
      deduction = disc + promo
    } else {
      const itemSubtotal = (o.order_items || []).reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0)
      deduction = itemSubtotal > totalAmt ? itemSubtotal - totalAmt : 0
    }

    // Accumulate COGS (HPP)
    const oType = outletTypeMap.get(o.outlet_id)
    const orderChannel = (o.channel || o.sales_source || '').toLowerCase()
    if (o.order_items && Array.isArray(o.order_items)) {
      for (const oi of o.order_items) {
        const qty = Number(oi.quantity || 1)
        let itemHpp = 0
        const mi = oi.menu_items
        if (mi) {
          let channelHppVal: number | null = null
          if (mi.channel_hpp && typeof mi.channel_hpp === 'object' && orderChannel) {
            if (
              orderChannel === 'ss-online' ||
              orderChannel === 'ss_online' ||
              orderChannel.includes('tiktok') ||
              orderChannel.includes('shopee') ||
              orderChannel === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' ||
              orderChannel === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'
            ) {
              channelHppVal = mi.channel_hpp.ss_online ?? mi.channel_hpp.tiktok_shop ?? mi.channel_hpp.shopee_shop ?? mi.channel_hpp[orderChannel] ?? null
            } else {
              channelHppVal = mi.channel_hpp[orderChannel] ?? null
            }
          }

          if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
            itemHpp = Number(channelHppVal)
          } else if (mi.hpp_override !== null && mi.hpp_override !== undefined && Number(mi.hpp_override) > 0) {
            itemHpp = Number(mi.hpp_override)
          } else if (mi.is_package && Array.isArray(mi.package_items)) {
            itemHpp = mi.package_items.reduce((sum: number, pkg: any) => {
              const compHpp = Number(pkg.component?.hpp_override || 0)
              const pQty = Number(pkg.quantity || 1)
              return sum + compHpp * pQty
            }, 0)
          }
        }
        if (oType === 'mitra' && itemHpp > 0) {
          itemHpp = Math.round(itemHpp * 1.1)
        }
        totalCogs += qty * itemHpp
      }
    }

    // Accumulate KPI
    const key = `${o.outlet_id}|${srcKey}|${dateStr}`
    const existing = acc.get(key)
    if (existing) {
      existing.omzet += totalAmt
      existing.jumlah_order_completed += 1
      existing.jumlah_order_all += 1
      existing.total_deductions = (existing.total_deductions || 0) + deduction
    } else {
      acc.set(key, {
        outlet_id: o.outlet_id,
        outlet_name: '',
        sales_source: srcKey,
        sales_date: dateStr,
        omzet: totalAmt,
        total_deductions: deduction,
        jumlah_order_completed: 1,
        jumlah_order_all: 1,
      })
    }

    // Accumulate Hourly
    const b = hourMap.get(hour)
    if (b) {
      b.omzet += totalAmt
      b.jumlah_order_completed += 1
    }
  }

  const summaryResult = Array.from(acc.values())
  const nameById = new Map(outlets.map((o) => [o.id, o.name]))
  let kpiRows = summaryResult.map((r) => ({
    ...r,
    outlet_name: nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
  }))

  if (ecData) {
    kpiRows = [...kpiRows, ...ecData.kpiRows]
    for (const h of ecData.hourlyRows) {
      const cur = hourMap.get(h.sales_hour) || { sales_hour: h.sales_hour, omzet: 0, jumlah_order_completed: 0 }
      cur.omzet += h.omzet
      cur.jumlah_order_completed += h.jumlah_order_completed
      hourMap.set(h.sales_hour, cur)
    }
    totalCogs += ecData.totalCogs
    totalOpex += ecData.totalOpex
  }

  const hourlyRows = Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour)

  return {
    kpiRows,
    hourlyRows,
    totalCogs,
    totalOpex,
    totalCogsOpex: totalCogs + totalOpex,
  }
}

// ── Fast version: semua agregasi dikerjakan PostgreSQL via RPC ────────────
export async function getOwnerDashboardDataFast(
  filter: PeriodFilterValue,
  outlets: Outlet[]
) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as any)
        })
      } catch { /* SSR ignored */ }
    }
  })

  const fromStart = new Date(`${filter.from}T00:00:00.000+07:00`)
  const toEnd    = new Date(`${filter.to}T23:59:59.999+07:00`)

  const isSSOnlineOnly = filter.outletId === 'ss-online'
  const isAll = filter.outletId === 'all'

  if (isSSOnlineOnly) {
    const ecData = await fetchEcommerceOwnerData(supabase, fromStart, toEnd, filter.source)
    return {
      ...ecData,
      totalCogsOpex: ecData.totalCogs + ecData.totalOpex,
    }
  }

  const rpcPromise = supabase.rpc('get_owner_dashboard_summary', {
    p_from:           fromStart.toISOString(),
    p_to:             toEnd.toISOString(),
    p_outlet_id:      filter.outletId !== 'all' ? filter.outletId : null,
    p_source:         filter.source,
    p_test_outlet_id: TEST_OUTLET_ID,
  })

  const ecPromise = isAll ? fetchEcommerceOwnerData(supabase, fromStart, toEnd, filter.source) : Promise.resolve(null)

  const [{ data, error }, ecData] = await Promise.all([rpcPromise, ecPromise])

  if (error) throw new Error(`get_owner_dashboard_summary: ${error.message}`)

  const result = data as {
    kpi_rows:    Array<{
      outlet_id: string; sales_source: string; sales_date: string
      omzet: number; order_count: number; total_deductions: number
    }>
    hourly_rows: Array<{ sales_hour: number; omzet: number; order_count: number }>
    menu_rows:   Array<{ menu_name: string; qty: number; revenue: number }>
    total_cogs:  number
    total_opex:  number
  }

  const nameById = new Map(outlets.map((o) => [o.id, o.name]))

  const posKpiRows: SalesSummaryRow[] = (result.kpi_rows ?? []).map((r) => ({
    outlet_id:              r.outlet_id,
    outlet_name:            nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
    sales_source:           r.sales_source as SalesSource,
    sales_date:             r.sales_date,
    omzet:                  Number(r.omzet),
    jumlah_order_completed: Number(r.order_count),
    jumlah_order_all:       Number(r.order_count),
    total_deductions:       Number(r.total_deductions),
  }))

  const hourMap = new Map<number, SalesHourlyRow>()
  for (let i = 0; i < 24; i++) {
    hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })
  }
  for (const h of result.hourly_rows ?? []) {
    hourMap.set(h.sales_hour, {
      sales_hour:             h.sales_hour,
      omzet:                  Number(h.omzet),
      jumlah_order_completed: Number(h.order_count),
    })
  }

  const menuMap = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const r of result.menu_rows ?? []) {
    const clean = cleanItemName(r.menu_name) || 'Unknown Menu'
    const cur = menuMap.get(clean) || { name: clean, qty: 0, revenue: 0 }
    cur.qty += Number(r.qty || 0)
    cur.revenue += Number(r.revenue || 0)
    menuMap.set(clean, cur)
  }

  let totalCogs = Number(result.total_cogs ?? 0)
  let totalOpex = Number(result.total_opex ?? 0)

  let kpiRows = posKpiRows
  if (ecData) {
    kpiRows = [...posKpiRows, ...ecData.kpiRows]
    for (const h of ecData.hourlyRows) {
      const cur = hourMap.get(h.sales_hour) || { sales_hour: h.sales_hour, omzet: 0, jumlah_order_completed: 0 }
      cur.omzet += h.omzet
      cur.jumlah_order_completed += h.jumlah_order_completed
      hourMap.set(h.sales_hour, cur)
    }
    for (const m of ecData.menuRows) {
      const clean = cleanItemName(m.name) || 'Unknown Menu'
      const cur = menuMap.get(clean) || { name: clean, qty: 0, revenue: 0 }
      cur.qty += m.qty
      cur.revenue += m.revenue
      menuMap.set(clean, cur)
    }
    totalCogs += ecData.totalCogs
    totalOpex += ecData.totalOpex
  }

  const hourlyRows = Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour)
  const menuRows = Array.from(menuMap.values())

  return {
    kpiRows,
    hourlyRows,
    menuRows,
    totalCogs,
    totalOpex,
    totalCogsOpex: totalCogs + totalOpex,
  }
}

/* ── Fetch REAL Petty Cash (Expenses + Shifts Starting Cash) ─────────── */

export async function getPettyCashData(
  filter: PeriodFilterValue,
  outlets: Outlet[]
): Promise<{
  transactions: PettyCashTransaction[]
  dailySummaries: DailyPettyCashSummary[]
}> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })

  // 1. Fetch Staff & User Mapping for Real Crew Names
  const [{ data: staffList }, { data: userList }] = await Promise.all([
    supabase.from('outlet_staff').select('id, name, role, outlet_id').limit(1000),
    supabase.from('users').select('id, name, username').limit(1000)
  ])

  const staffMap = new Map((staffList || []).map((s) => [s.id, s.name]))
  const userMap = new Map((userList || []).map((u) => [u.id, u.name || u.username]))

  const staffByOutlet = new Map<string, string[]>()
  for (const s of staffList || []) {
    if (s.outlet_id && s.name) {
      const existing = staffByOutlet.get(s.outlet_id) || []
      existing.push(s.name)
      staffByOutlet.set(s.outlet_id, existing)
    }
  }

  // 2. Query REAL table `shifts` for Starting Petty Cash (Modal Diserahkan)
  let shiftQuery = supabase
    .from('shifts')
    .select('*, outlets(name)')
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .order('end_time', { ascending: false })
    .limit(500)

  if (filter.outletId && filter.outletId !== 'all') {
    shiftQuery = shiftQuery.eq('outlet_id', filter.outletId)
  }

  // 3. Query REAL table `petty_cash_expenses` for Kas Keluar
  let expenseQuery = supabase
    .from('petty_cash_expenses')
    .select('*, outlets(name)')
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (filter.from) {
    expenseQuery = expenseQuery.gte('expense_date', filter.from)
  }
  if (filter.to) {
    expenseQuery = expenseQuery.lte('expense_date', filter.to)
  }
  if (filter.outletId && filter.outletId !== 'all') {
    expenseQuery = expenseQuery.eq('outlet_id', filter.outletId)
  }

  let topupQuery = supabase
    .from('petty_cash_topups')
    .select('*, outlets(name)')
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .in('status', ['forwarded_by_leader', 'approved', 'completed'])
    .order('created_at', { ascending: false })
    .limit(500)

  if (filter.from) {
    topupQuery = topupQuery.gte('created_at', `${filter.from}T00:00:00.000+07:00`)
  }
  if (filter.to) {
    topupQuery = topupQuery.lte('created_at', `${filter.to}T23:59:59.999+07:00`)
  }
  if (filter.outletId && filter.outletId !== 'all') {
    topupQuery = topupQuery.eq('outlet_id', filter.outletId)
  }

  const [{ data: shiftRows }, { data: expenseRows }, { data: topupRows }] = await Promise.all([
    shiftQuery,
    expenseQuery,
    topupQuery,
  ])

  // Map starting cash from shifts as Kas Masuk
  const shiftEntries: PettyCashTransaction[] = (shiftRows || [])
    .filter((s: any) => {
      if (Number(s.starting_petty_cash) <= 0) return false
      const dateStr = s.end_time ? s.end_time.split('T')[0] : s.start_time ? s.start_time.split('T')[0] : ''
      if (filter.from && dateStr < filter.from) return false
      if (filter.to && dateStr > filter.to) return false
      return true
    })
    .map((s: any) => {
      let resolvedStaffName = staffMap.get(s.staff_id) || staffMap.get(s.closed_by) || userMap.get(s.staff_id)
      if (!resolvedStaffName && s.outlet_id) {
        const candidates = staffByOutlet.get(s.outlet_id)
        if (candidates && candidates.length > 0) resolvedStaffName = candidates[0]
      }
      return {
        id: `shift-start-${s.id}`,
        outlet_id: s.outlet_id || '',
        outlet_name: s.outlets?.name || 'Outlet Utama',
        transaction_date: s.start_time || s.created_at,
        type: 'in' as const,
        category: 'Modal Awal Kasir',
        description: 'Modal awal kas kecil diserahkan per shift',
        amount: Number(s.starting_petty_cash) || 0,
        staff_name: resolvedStaffName || 'Kasir Staff',
        receipt_url: null,
      }
    })

  // Map expenses from petty_cash_expenses as Kas Keluar
  const expenseEntries: PettyCashTransaction[] = (expenseRows || []).map((r: any) => {
    let resolvedStaffName = staffMap.get(r.created_by) || userMap.get(r.created_by)
    if (!resolvedStaffName && r.outlet_id) {
      const candidates = staffByOutlet.get(r.outlet_id)
      if (candidates && candidates.length > 0) resolvedStaffName = candidates[0]
    }
    if (!resolvedStaffName) resolvedStaffName = 'Staff Kasir'

    let tDate = r.expense_date || r.created_at
    if (r.expense_date && r.created_at && r.expense_date.length === 10) {
      const timePart = r.created_at.includes('T') ? r.created_at.split('T')[1] : '00:00:00Z'
      tDate = `${r.expense_date}T${timePart}`
    }

    return {
      id: r.id,
      outlet_id: r.outlet_id || outlets[0]?.id || '',
      outlet_name: r.outlets?.name || 'Global Outlet',
      transaction_date: tDate,
      type: 'out',
      category: r.category || 'Operasional',
      description: r.description || 'Pengeluaran petty cash kasir',
      amount: Number(r.amount) || 0,
      staff_name: resolvedStaffName,
      receipt_url: r.receipt_url || null,
    }
  })

  // Map topups from petty_cash_topups as Kas Masuk
  const topupEntries: PettyCashTransaction[] = (topupRows || []).map((r: any) => {
    let resolvedStaffName = staffMap.get(r.created_by) || userMap.get(r.created_by)
    if (!resolvedStaffName && r.outlet_id) {
      const candidates = staffByOutlet.get(r.outlet_id)
      if (candidates && candidates.length > 0) resolvedStaffName = candidates[0]
    }
    if (!resolvedStaffName) resolvedStaffName = 'Finance Staff'

    let tDate = r.completed_at || r.created_at

    return {
      id: r.id,
      outlet_id: r.outlet_id || outlets[0]?.id || '',
      outlet_name: r.outlets?.name || 'Global Outlet',
      transaction_date: tDate,
      type: 'in',
      category: 'Top Up Petty Cash',
      description: r.description || 'Pengisian saldo petty cash',
      amount: Number(r.amount) || 0,
      staff_name: resolvedStaffName,
      receipt_url: r.proof_of_transfer_url || null,
    }
  })

  // Filter topupEntries and expenseEntries to only include those that fall WITHIN a shift
  // Interim transactions are already rolled into the starting_petty_cash of the next shift
  const activeTopupEntries = topupEntries.filter(t => {
    return (shiftRows || []).some((s: any) => {
      if (s.outlet_id !== t.outlet_id) return false
      const sStart = new Date(s.start_time).getTime()
      const sEnd = s.end_time ? new Date(s.end_time).getTime() : Date.now() + 86400000 * 365 // Future if open
      const tTime = new Date(t.transaction_date).getTime()
      return tTime >= sStart && tTime <= sEnd
    })
  })

  const activeExpenseEntries = expenseEntries.filter(e => {
    return (shiftRows || []).some((s: any) => {
      if (s.outlet_id !== e.outlet_id) return false
      const sStart = new Date(s.start_time).getTime()
      const sEnd = s.end_time ? new Date(s.end_time).getTime() : Date.now() + 86400000 * 365
      const eTime = new Date(e.transaction_date).getTime()
      return eTime >= sStart && eTime <= sEnd
    })
  })

  // Combine and sort all transactions by transaction_date DESC
  const allTransactions = [...shiftEntries, ...activeExpenseEntries, ...activeTopupEntries].sort((a, b) =>
    b.transaction_date.localeCompare(a.transaction_date)
  )

  // Compute Daily Summaries
  const dailyMap = new Map<string, DailyPettyCashSummary>()

  for (const t of allTransactions) {
    const dateKey = t.transaction_date.slice(0, 10)
    const existing = dailyMap.get(dateKey) || {
      date: dateKey,
      total_in: 0,
      total_out: 0,
      ending_balance: 0,
      shift_count: 0,
    }

    if (t.type === 'in') {
      existing.total_in += t.amount
      existing.shift_count++
    } else {
      existing.total_out += t.amount
    }
    existing.ending_balance = existing.total_in - existing.total_out
    dailyMap.set(dateKey, existing)
  }

  const dailySummaries = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date))

  return {
    transactions: allTransactions,
    dailySummaries,
  }
}

/* ── Fetch REAL Attendance Rekap & Stealth Photos from `attendance` ──── */

export async function getAttendanceReportData(
  filter: PeriodFilterValue,
  outlets: Outlet[]
): Promise<AttendanceRecordExt[]> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      } catch {
        // Ignored, might be called from a Server Component.
      }
    }
  })

  // 1. Fetch Staff & Outlets for Mapping
  const [{ data: staffList }, { data: outletsList }] = await Promise.all([
    supabase.from('outlet_staff').select('id, name, role').limit(1000),
    supabase.from('outlets').select('id, name').limit(500)
  ])

  const staffMap = new Map((staffList || []).map((s) => [s.id, s]))
  const outletMap = new Map((outletsList || []).map((o) => [o.id, o.name]))

  // We will batch-sign the stealth photo URLs below to prevent server timeout
  // 2. Query REAL table `attendance` (singular) where all stealth camera photos are recorded
  let query = supabase
    .from('attendance')
    .select('*')
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .order('ts_server', { ascending: false })
    .limit(1000)

  if (filter.from) {
    query = query.gte('ts_server', `${filter.from}T00:00:00.000+07:00`)
  }
  if (filter.to) {
    query = query.lte('ts_server', `${filter.to}T23:59:59.999+07:00`)
  }
  if (filter.outletId && filter.outletId !== 'all') {
    query = query.eq('outlet_id', filter.outletId)
  }

  const { data: attRows, error } = await query

  if (error || !attRows) {
    console.error('Error querying table attendance from DB:', error?.message)
    return []
  }

  // Group attendance entries by `${outlet_staff_id}|${outlet_id}|${date}`
  const grouped = new Map<string, {
    id: string
    staff_id: string
    staff_name: string
    staff_role: string
    outlet_id: string
    outlet_name: string
    date: string
    clock_in: string | null
    clock_out: string | null
    raw_photo_in: string | null
    raw_photo_out: string | null
    gps_lat_in: number | null
    gps_lng_in: number | null
    gps_lat_out: number | null
    gps_lng_out: number | null
    status: string
    late_minutes: number
    out_status: string | null
    out_minutes: number | null
    notes: string | null
  }>()

  for (const r of attRows) {
    const dateStr = r.ts_server
      ? new Date(r.ts_server).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      : ''
    const key = `${r.outlet_staff_id}|${r.outlet_id}|${dateStr}`
    const st = staffMap.get(r.outlet_staff_id)
    const outletName = outletMap.get(r.outlet_id)

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: r.id,
        staff_id: r.outlet_staff_id || '',
        staff_name: st?.name || 'Kasir Staff',
        staff_role: (st?.role || 'CREW').toUpperCase(),
        outlet_id: r.outlet_id || '',
        outlet_name: outletName || 'Outlet Utama',
        date: dateStr,
        clock_in: null,
        clock_out: null,
        raw_photo_in: null,
        raw_photo_out: null,
        gps_lat_in: null,
        gps_lng_in: null,
        gps_lat_out: null,
        gps_lng_out: null,
        status: 'hadir',
        late_minutes: 0,
        out_status: null,
        out_minutes: null,
        notes: null,
      })
    }

    const item = grouped.get(key)!
    if (r.type === 'in') {
      item.clock_in = new Date(r.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
      item.raw_photo_in = r.selfie_url || null
      if (r.gps_lat) item.gps_lat_in = Number(r.gps_lat)
      if (r.gps_lng) item.gps_lng_in = Number(r.gps_lng)
      if (r.status === 'telat_toleransi') {
        item.status = 'telat_toleransi'
        item.late_minutes = r.telat_menit || 0
      } else if (r.status === 'telat' || r.status === 'terlambat') {
        item.status = 'terlambat'
        item.late_minutes = r.telat_menit || 0
      }
    } else if (r.type === 'out') {
      item.clock_out = new Date(r.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
      item.raw_photo_out = r.selfie_url || null
      if (r.gps_lat) item.gps_lat_out = Number(r.gps_lat)
      if (r.gps_lng) item.gps_lng_out = Number(r.gps_lng)
      item.out_status = r.status || 'tepat'
      item.out_minutes = r.telat_menit || 0
    }
  }

  // Gather all unique photo paths
  const pathsToSign = new Set<string>()
  for (const item of grouped.values()) {
    if (item.raw_photo_in && !item.raw_photo_in.startsWith('http')) pathsToSign.add(item.raw_photo_in)
    if (item.raw_photo_out && !item.raw_photo_out.startsWith('http')) pathsToSign.add(item.raw_photo_out)
  }

  // Batch sign the URLs in chunks of 100 to avoid overloading the API
  const pathArray = Array.from(pathsToSign)
  const signedUrlsMap = new Map<string, string>()
  const chunkSize = 100
  
  for (let i = 0; i < pathArray.length; i += chunkSize) {
    const chunk = pathArray.slice(i, i + chunkSize)
    const { data: signedUrls } = await supabase.storage.from('selfies').createSignedUrls(chunk, 3600)
    if (signedUrls) {
      for (const su of signedUrls) {
        if (su.signedUrl) signedUrlsMap.set(su.path, su.signedUrl)
      }
    }
  }

  // Convert grouped items to AttendanceRecordExt with Signed Stealth Photo URLs & Out Status
  const result: AttendanceRecordExt[] = Array.from(grouped.values()).map((item) => {
    let signedIn = item.raw_photo_in
    if (signedIn && !signedIn.startsWith('http')) {
      signedIn = signedUrlsMap.get(signedIn) || null
    }

    let signedOut = item.raw_photo_out
    if (signedOut && !signedOut.startsWith('http')) {
      signedOut = signedUrlsMap.get(signedOut) || null
    }

    return {
      id: item.id,
      staff_id: item.staff_id,
      staff_name: item.staff_name,
      staff_role: item.staff_role,
      outlet_id: item.outlet_id,
      outlet_name: item.outlet_name,
      date: item.date,
      clock_in: item.clock_in,
      clock_out: item.clock_out,
      status: item.status,
      late_minutes: item.late_minutes,
      out_status: item.out_status,
      out_minutes: item.out_minutes,
      notes: item.notes,
      stealth_photo_in_url: signedIn,
      stealth_photo_out_url: signedOut,
      gps_lat_in: item.gps_lat_in,
      gps_lng_in: item.gps_lng_in,
      gps_lat_out: item.gps_lat_out,
      gps_lng_out: item.gps_lng_out,
    }
  })

  return result.sort((a, b) => b.date.localeCompare(a.date))
}

