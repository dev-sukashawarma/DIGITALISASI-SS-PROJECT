'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function fetchOutletRevenue({
  startDate,
  endDate,
  selectedOutletId,
  selectedChannel
}: {
  startDate: string
  endDate: string
  selectedOutletId: string
  selectedChannel: string
}) {
  const from = startDate
  const to = endDate

  const fetchAllSales = async () => {
    let allSales: any[] = []
    let offset = 0
    const limit = 1000
    while (true) {
      let q = supabase
        .from('orders')
        .select('created_at, outlet_id, sales_source, total_amount, discount_amount, promo_subsidy, order_items(subtotal)')
        .eq('status', 'completed')
        .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
        .gte('created_at', `${from}T00:00:00+07:00`)
        .lte('created_at', `${to}T23:59:59+07:00`)
        .range(offset, offset + limit - 1)
      
      if (selectedOutletId !== 'all') {
        q = q.eq('outlet_id', selectedOutletId)
      }
      if (selectedChannel !== 'all') {
        q = q.eq('sales_source', selectedChannel)
      }
      
      const { data, error } = await q
      if (error) throw error
      if (data) allSales = allSales.concat(data)
      if (!data || data.length < limit) break
      offset += limit
    }
    return allSales
  }

  const [salesData, outletsRes] = await Promise.all([
    fetchAllSales(),
    supabase
      .from('outlets')
      .select('id, name')
  ])

  if (outletsRes.error) throw outletsRes.error

  const nameMap = new Map<string, string>()
  outletsRes.data?.forEach(o => nameMap.set(o.id, o.name))

  const aggMap = new Map<string, { date: string; outletId: string; outletName: string; channel: string; totalRevenue: number; totalOrders: number; totalPotongan: number; netRevenue: number; potonganSource: string }>()

  salesData.forEach(s => {
    const d = new Date(s.created_at)
    const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const outletId = s.outlet_id
    const channel = s.sales_source || 'Offline'
    const outletName = nameMap.get(outletId) || 'Outlet Tidak Dikenal'
    const key = `${date}-${outletId}-${channel}`
    
    const netAmt = Number(s.total_amount || 0)
    let disc = Number(s.discount_amount || 0)
    let promoApps = Number(s.promo_subsidy || 0)
    let potongan = 0
    let src = ''
    
    if (disc > 0 || promoApps > 0) {
      potongan = disc + promoApps
      if (disc > 0 && promoApps > 0) src = 'Promo/Diskon, Promo Apps'
      else if (disc > 0) src = 'Promo/Diskon'
      else if (promoApps > 0) src = 'Promo Apps'
    } else {
      const itemSubtotal = (s.order_items as any[] || []).reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0)
      const itemDiff = itemSubtotal > netAmt ? itemSubtotal - netAmt : 0
      if (itemDiff > 0) {
        potongan = itemDiff
        src = 'Diskon Item'
      }
    }
    
    const gross = netAmt + potongan
    const net = netAmt
    
    const existing = aggMap.get(key)
    if (existing) {
      existing.totalRevenue += gross
      existing.totalOrders += 1
      existing.totalPotongan += potongan
      existing.netRevenue += net
      if (src.includes('Promo/Diskon') && !existing.potonganSource.includes('Promo/Diskon')) {
        existing.potonganSource += existing.potonganSource ? ', Promo/Diskon' : 'Promo/Diskon'
      }
      if (src.includes('Promo Apps') && !existing.potonganSource.includes('Promo Apps')) {
        existing.potonganSource += existing.potonganSource ? ', Promo Apps' : 'Promo Apps'
      }
      if (src.includes('Diskon Item') && !existing.potonganSource.includes('Diskon Item')) {
        existing.potonganSource += existing.potonganSource ? ', Diskon Item' : 'Diskon Item'
      }
    } else {
      aggMap.set(key, {
        date,
        outletId,
        outletName,
        channel,
        totalRevenue: gross,
        totalOrders: 1,
        totalPotongan: potongan,
        netRevenue: net,
        potonganSource: src
      })
    }
  })

  return Array.from(aggMap.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return b.totalRevenue - a.totalRevenue
  })
}

export async function fetchSalesItems({
  startDate,
  endDate,
  selectedOutletId,
  selectedChannel
}: {
  startDate: string
  endDate: string
  selectedOutletId: string
  selectedChannel: string
}) {
  const from = startDate
  const to = endDate

  const fetchAllItems = async () => {
    let allItems: any[] = []
    let offset = 0
    const limit = 1000
    while (true) {
      let q = supabase
        .from('sales_items_spv')
        .select('sales_date, outlet_id, sales_source, menu_item_name, total_qty, total_revenue')
        .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
        .gte('sales_date', from)
        .lte('sales_date', to)
        .range(offset, offset + limit - 1)

      if (selectedOutletId !== 'all') {
        q = q.eq('outlet_id', selectedOutletId)
      }
      if (selectedChannel !== 'all') {
        q = q.eq('sales_source', selectedChannel)
      }

      const { data, error } = await q
      if (error) throw error
      if (data) allItems = allItems.concat(data)
      if (!data || data.length < limit) break
      offset += limit
    }
    return allItems
  }

  const [itemsDataRaw, outletsRes] = await Promise.all([
    fetchAllItems(),
    supabase
      .from('outlets')
      .select('id, name')
  ])

  if (outletsRes.error) throw outletsRes.error

  const nameMap = new Map<string, string>()
  outletsRes.data?.forEach(o => nameMap.set(o.id, o.name))
  
  const aggMap = new Map<string, { date: string; outletId: string; outletName: string; channel: string; itemName: string; totalQty: number; totalRevenue: number }>()

  itemsDataRaw.forEach(s => {
    const date = s.sales_date || 'Unknown Date'
    const outletId = s.outlet_id
    const channel = s.sales_source || 'Offline'
    const outletName = nameMap.get(outletId) || 'Outlet Tidak Dikenal'
    
    let cleanName = s.menu_item_name || 'Unknown Item'
    const idIndex = cleanName.indexOf('|ID|')
    if (idIndex !== -1) {
      cleanName = cleanName.substring(0, idIndex).trim()
    }

    const key = `${date}-${outletId}-${channel}-${cleanName}`
    
    const existing = aggMap.get(key)
    if (existing) {
      existing.totalQty += Number(s.total_qty || 0)
      existing.totalRevenue += Number(s.total_revenue || 0)
    } else {
      aggMap.set(key, {
        date,
        outletId,
        outletName,
        channel,
        itemName: cleanName,
        totalQty: Number(s.total_qty || 0),
        totalRevenue: Number(s.total_revenue || 0)
      })
    }
  })
  
  return Array.from(aggMap.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    if (a.outletName === b.outletName) return b.totalQty - a.totalQty
    return a.outletName.localeCompare(b.outletName)
  })
}
