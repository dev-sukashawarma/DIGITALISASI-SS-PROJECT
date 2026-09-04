'use server'

import { createClient } from '@/lib/supabase/server'
import { applyChannelFilter, isFoodAppOrder } from '@/lib/channel-filter'

type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom'

export async function fetchAnalyticsData(
  outletId: string,
  range: DateRange,
  customStart: string,
  customEnd: string,
  channelFilter: string = 'all',
  paymentFilter: string = 'all',
  statusFilter: string = 'all'
) {
  try {
    const supabase = await createClient()

    let p_start = new Date()
    let p_end = new Date()

    if (range === 'today') {
      p_start.setHours(0, 0, 0, 0)
      p_end.setHours(23, 59, 59, 999)
    } else if (range === 'yesterday') {
      p_start.setDate(p_start.getDate() - 1)
      p_start.setHours(0, 0, 0, 0)
      p_end.setDate(p_end.getDate() - 1)
      p_end.setHours(23, 59, 59, 999)
    } else if (range === '7days') {
      p_start.setDate(p_start.getDate() - 7)
      p_start.setHours(0, 0, 0, 0)
      p_end.setHours(23, 59, 59, 999)
    } else if (range === '30days') {
      p_start.setDate(p_start.getDate() - 30)
      p_start.setHours(0, 0, 0, 0)
      p_end.setHours(23, 59, 59, 999)
    } else if (range === 'all') {
      p_start = new Date(0)
      p_end.setHours(23, 59, 59, 999)
    } else if (range === 'custom' && customStart && customEnd) {
      p_start = new Date(customStart)
      p_start.setHours(0, 0, 0, 0)
      p_end = new Date(customEnd)
      p_end.setHours(23, 59, 59, 999)
    }

    let ordersQuery = supabase
      .from('orders')
      .select('id, status, payment_method, channel, sales_source, total_amount, discount_amount, promo_subsidy, created_at, voided_by, void_reason, cancellation_reason, order_items(id, menu_item_name, quantity, subtotal)')
      .eq('outlet_id', outletId)
      .gte('created_at', p_start.toISOString())
      .lte('created_at', p_end.toISOString())

    if (statusFilter !== 'all') {
      ordersQuery = ordersQuery.eq('status', statusFilter)
    }
    if (paymentFilter !== 'all') {
      ordersQuery = ordersQuery.eq('payment_method', paymentFilter)
    }
    ordersQuery = applyChannelFilter(ordersQuery, channelFilter)

    const { data: ordersData, error } = await ordersQuery
    if (error) throw error

    const completedOrders = (ordersData || []).filter((o: any) => o.status === 'completed')

    const netRevenue = completedOrders.reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0)

    // ACUAN TUNGGAL Omzet Kotor (lihat migration 20300128000000):
    //   Potongan    = MAX(0, SUM(order_items.subtotal) - total_amount)
    //   Omzet Kotor = total_amount + Potongan
    // Bertumpu pada nilai menu, bukan pada discount_amount/promo_subsidy, karena
    // arti `total_amount` sempat berubah (19 Agustus 2026, commit b41efc7a).
    // Subsidi food apps TIDAK masuk sini -- dilaporkan terpisah sebagai
    // totalPromoSubsidy.
    const totalDeductions = completedOrders.reduce((s: number, o: any) => {
      const items = Array.isArray(o.order_items) ? o.order_items : []
      const total = Number(o.total_amount) || 0
      if (items.length === 0) return s + (Number(o.discount_amount) || 0)
      const itemValue = items.reduce((sum: number, i: any) => sum + (Number(i.subtotal) || 0), 0)
      return s + Math.max(0, itemValue - total)
    }, 0)

    // Potongan App: subsidi promo food apps. Tidak memotong total_amount (food apps
    // dicatat dengan harga menu asli), ditampilkan terpisah untuk rekonsiliasi.
    const totalPromoSubsidy = completedOrders.reduce((s: number, o: any) => {
      return isFoodAppOrder(o) ? s + (Number(o.promo_subsidy) || 0) : s
    }, 0)

    // Omzet Kotor -- label & angka disamakan dengan dashboard pusat.
    const totalRevenue = netRevenue + totalDeductions
    const totalOrders = completedOrders.length
    const pendingCount = (ordersData || []).filter((o: any) => o.status === 'pending').length
    const canceledCount = (ordersData || []).filter((o: any) => o.status === 'cancelled' || o.cancellation_status === 'pending_approval').length
    const avgOrderValue = totalOrders > 0 ? Math.round(netRevenue / totalOrders) : 0

    const paymentBreakdown: Record<string, { count: number; revenue: number }> = {}
    const hourly = Array(24).fill(0)
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}

    completedOrders.forEach((o: any) => {
      const pm = o.payment_method || 'unknown'
      const netAmount = Number(o.total_amount) || 0
      if (!paymentBreakdown[pm]) paymentBreakdown[pm] = { count: 0, revenue: 0 }
      paymentBreakdown[pm].count++
      paymentBreakdown[pm].revenue += netAmount

      const d = new Date(o.created_at)
      const h = (d.getUTCHours() + 7) % 24
      hourly[h]++

      if (Array.isArray(o.order_items)) {
        o.order_items.forEach((oi: any) => {
          let name = oi.menu_item_name || 'Item'
          name = name.split('|NOTE|')[0].split('|PARENT|')[0].split('|ID|')[0]
          if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0 }
          itemMap[name].qty += Number(oi.quantity) || 0
          itemMap[name].revenue += Number(oi.subtotal) || 0
        })
      }
    })

    const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10)
    const totalItemsSold = Object.values(itemMap).reduce((sum, item) => sum + item.qty, 0)

    let maxHourlyCount = 0
    let peakHour: number | null = null
    for (let i = 0; i < 24; i++) {
      if (hourly[i] > maxHourlyCount) {
        maxHourlyCount = hourly[i]
        peakHour = i
      }
    }

    return {
      totalRevenue,
      totalDeductions,
      totalPromoSubsidy,
      netRevenue,
      totalOrders,
      totalItemsSold,
      avgOrderValue,
      pendingCount,
      canceledCount,
      paymentBreakdown,
      hourly,
      peakHour,
      bestSellers,
      categoryData: []
    }
  } catch (err: any) {
    throw new Error(err.message)
  }
}
