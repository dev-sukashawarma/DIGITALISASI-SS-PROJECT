'use server'

import { getPosSupabase } from '@/lib/supabase-pos'

export interface OutletRankingItem {
  outletId: string
  outletName: string
  outletType: string
  region: string | null
  omzetKotor: number
  totalTrx: number
  percentageShare: number
  rank: number
}

export interface MenuRankingItem {
  name: string
  totalQty: number
  totalRevenue: number
  percentageQtyShare: number
  percentageRevShare: number
  rank: number
}

export interface SalesReferenceData {
  period: string
  startDate: string
  endDate: string
  outletId: string
  totalOmzetKotor: number
  totalTransactions: number
  totalItemsSold: number
  outletRankings: OutletRankingItem[]
  menuRankings: MenuRankingItem[]
}

export interface OutletOption {
  id: string
  name: string
  type: string
}

// Clean raw item name from pos metadata
function cleanItemName(raw: string): string {
  let name = raw ?? ''
  const noteSplit = name.split('|NOTE|')
  if (noteSplit.length > 1) name = noteSplit[0]
  const parentSplit = name.split('|PARENT|')
  if (parentSplit.length > 1) name = parentSplit[0]
  const idSplit = name.split('|ID|')
  if (idSplit.length > 1) name = idSplit[0]
  return name.trim()
}

// Test outlet ID to exclude
const TEST_OUTLET_ID = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'

export async function fetchOutletsList(): Promise<OutletOption[]> {
  try {
    const supabase = getPosSupabase()
    const { data, error } = await supabase
      .from('outlets')
      .select('id, name, type')
      .neq('id', TEST_OUTLET_ID)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error || !data) {
      console.error('Error fetching outlets in sales-reference:', error)
      return []
    }

    return data.map((o: any) => ({
      id: String(o.id),
      name: String(o.name || ''),
      type: String(o.type || 'outlet'),
    }))
  } catch (err) {
    console.error('fetchOutletsList exception:', err)
    return []
  }
}

// Helper to chunk-fetch all rows from Supabase view in parallel
async function fetchAllViewRows(
  table: string,
  select: string,
  startDate: string,
  endDate: string,
  outletId?: string
): Promise<any[]> {
  try {
    const supabase = getPosSupabase()
    let countQuery = supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .gte('sales_date', startDate)
      .lte('sales_date', endDate)
      .neq('outlet_id', TEST_OUTLET_ID)

    if (outletId && outletId !== 'ALL') {
      countQuery = countQuery.eq('outlet_id', outletId)
    }

    const { count, error: countErr } = await countQuery
    if (countErr || count === null || count === 0) {
      if (countErr) console.error(`Error counting ${table}:`, countErr)
      return []
    }

    const step = 1000
    const pages = Math.ceil(count / step)
    const tasks = []

    for (let i = 0; i < pages; i++) {
      let query = supabase
        .from(table)
        .select(select)
        .gte('sales_date', startDate)
        .lte('sales_date', endDate)
        .neq('outlet_id', TEST_OUTLET_ID)
        .range(i * step, (i + 1) * step - 1)

      if (outletId && outletId !== 'ALL') {
        query = query.eq('outlet_id', outletId)
      }
      tasks.push(query)
    }

    const results = await Promise.all(tasks)
    let all: any[] = []
    for (const res of results) {
      if (res.data) {
        all = all.concat(res.data)
      }
    }
    return all
  } catch (err) {
    console.error(`fetchAllViewRows failed on ${table}:`, err)
    return []
  }
}

export async function getSalesReferenceData(params: {
  period?: string
  startDate?: string
  endDate?: string
  outletId?: string
}): Promise<SalesReferenceData> {
  const period = params.period || 'thisMonth'
  const targetOutletId = params.outletId || 'ALL'

  try {

  // Determine date bounds in Asia/Jakarta (WIB)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const formatJakartaDate = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  let startDateStr = ''
  let endDateStr = ''

  if (period === 'today') {
    startDateStr = formatJakartaDate(now)
    endDateStr = formatJakartaDate(now)
  } else if (period === 'yesterday') {
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    startDateStr = formatJakartaDate(yest)
    endDateStr = formatJakartaDate(yest)
  } else if (period === '7days') {
    const d7 = new Date(now)
    d7.setDate(d7.getDate() - 6)
    startDateStr = formatJakartaDate(d7)
    endDateStr = formatJakartaDate(now)
  } else if (period === '30days') {
    const d30 = new Date(now)
    d30.setDate(d30.getDate() - 29)
    startDateStr = formatJakartaDate(d30)
    endDateStr = formatJakartaDate(now)
  } else if (period === 'lastMonth') {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const m = now.getMonth() === 0 ? 12 : now.getMonth()
    const lastDay = new Date(y, m, 0).getDate()
    startDateStr = `${y}-${pad(m)}-01`
    endDateStr = `${y}-${pad(m)}-${pad(lastDay)}`
  } else if (period === 'custom' && params.startDate && params.endDate) {
    startDateStr = params.startDate
    endDateStr = params.endDate
  } else {
    // Default 'thisMonth'
    startDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
    endDateStr = formatJakartaDate(now)
  }

  const supabase = getPosSupabase()

  // Fetch Outlets metadata, sales_daily_spv (all outlets to rank them), and sales_items_spv
  const [outletsRes, salesDailyRows, itemsRows] = await Promise.all([
    supabase
      .from('outlets')
      .select('id, name, type, region')
      .neq('id', TEST_OUTLET_ID)
      .eq('is_active', true),
    fetchAllViewRows(
      'sales_daily_spv',
      'outlet_id, omzet, total_deductions, jumlah_order_completed',
      startDateStr,
      endDateStr
    ),
    fetchAllViewRows(
      'sales_items_spv',
      'outlet_id, menu_item_name, total_qty, total_revenue',
      startDateStr,
      endDateStr,
      targetOutletId !== 'ALL' ? targetOutletId : undefined
    ),
  ])

  const outletsMap = new Map<string, { name: string; type: string; region: string | null }>()
  ;(outletsRes.data || []).forEach((o: any) => {
    outletsMap.set(String(o.id), {
      name: String(o.name || 'Outlet Tanpa Nama'),
      type: String(o.type || 'outlet'),
      region: o.region ? String(o.region) : null,
    })
  })

  // 1. Aggregate Sales by Outlet
  const outletAggregation = new Map<
    string,
    { omzetKotor: number; trx: number; outletName: string; outletType: string; region: string | null }
  >()

  let totalNationalOmzet = 0
  let totalNationalTrx = 0

  salesDailyRows.forEach((r: any) => {
    const outId = String(r.outlet_id)
    const omzetKotor = (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0)
    const trx = Number(r.jumlah_order_completed) || 0

    totalNationalOmzet += omzetKotor
    totalNationalTrx += trx

    if (!outletAggregation.has(outId)) {
      const info = outletsMap.get(outId)
      outletAggregation.set(outId, {
        omzetKotor: 0,
        trx: 0,
        outletName: info?.name || 'Outlet #' + outId.slice(0, 6),
        outletType: info?.type || 'outlet',
        region: info?.region || null,
      })
    }

    const item = outletAggregation.get(outId)!
    item.omzetKotor += omzetKotor
    item.trx += trx
  })

  // Convert outlet aggregation to sorted array
  const outletRankings: OutletRankingItem[] = Array.from(outletAggregation.entries())
    .map(([outletId, data]) => ({
      outletId,
      outletName: data.outletName,
      outletType: data.outletType,
      region: data.region,
      omzetKotor: data.omzetKotor,
      totalTrx: data.trx,
      percentageShare: totalNationalOmzet > 0 ? (data.omzetKotor / totalNationalOmzet) * 100 : 0,
      rank: 0,
    }))
    .sort((a, b) => b.omzetKotor - a.omzetKotor)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }))

  // 2. Aggregate Items Sales
  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>()
  let totalFilteredItemsSold = 0
  let totalFilteredItemRevenue = 0

  itemsRows.forEach((r: any) => {
    const rawName = r.menu_item_name
    const cleanName = cleanItemName(rawName)
    if (!cleanName) return

    const qty = Number(r.total_qty) || 0
    const rev = Number(r.total_revenue) || 0

    totalFilteredItemsSold += qty
    totalFilteredItemRevenue += rev

    if (!itemMap.has(cleanName)) {
      itemMap.set(cleanName, {
        name: cleanName,
        qty: 0,
        revenue: 0,
      })
    }

    const rec = itemMap.get(cleanName)!
    rec.qty += qty
    rec.revenue += rev
  })

  // Convert items to array (rank will be determined based on chosen sort order in client)
  const menuRankings: MenuRankingItem[] = Array.from(itemMap.values())
    .map((item) => ({
      name: item.name,
      totalQty: item.qty,
      totalRevenue: item.revenue,
      percentageQtyShare:
        totalFilteredItemsSold > 0 ? (item.qty / totalFilteredItemsSold) * 100 : 0,
      percentageRevShare:
        totalFilteredItemRevenue > 0 ? (item.revenue / totalFilteredItemRevenue) * 100 : 0,
      rank: 0,
    }))
    .sort((a, b) => b.totalQty - a.totalQty)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }))

  // Summary card metrics based on whether an outlet is filtered or all
  let displayOmzet = totalNationalOmzet
  let displayTrx = totalNationalTrx

  if (targetOutletId !== 'ALL') {
    const target = outletRankings.find((o) => o.outletId === targetOutletId)
    displayOmzet = target ? target.omzetKotor : 0
    displayTrx = target ? target.totalTrx : 0
  }

    return {
      period,
      startDate: startDateStr,
      endDate: endDateStr,
      outletId: targetOutletId,
      totalOmzetKotor: displayOmzet,
      totalTransactions: displayTrx,
      totalItemsSold: totalFilteredItemsSold,
      outletRankings,
      menuRankings,
    }
  } catch (err) {
    console.error('getSalesReferenceData failed:', err)
    return {
      period,
      startDate: '',
      endDate: '',
      outletId: targetOutletId,
      totalOmzetKotor: 0,
      totalTransactions: 0,
      totalItemsSold: 0,
      outletRankings: [],
      menuRankings: [],
    }
  }
}
