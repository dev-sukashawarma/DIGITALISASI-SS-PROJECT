'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'

export async function getMitraRoiStats(outletId: string | 'all', allowedOutletIds: string[]) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
    
  const targetOutlets = outletId === 'all' ? allowedOutletIds : [outletId]
  if (targetOutlets.length === 0) return { systemProfitMitra: 0, historisProfitMitra: 0, nilaiInvestasi: 0, totalProfitKumulatif: 0, roi: 0, bepPercentage: 0 }

  // 1. Fetch investments
  const { data: invData } = await supabase
    .from('mitra_investments')
    .select('*')
    .in('outlet_id', targetOutlets)
    
  let nilaiInvestasi = 0
  let historisProfitMitra = 0
  const invMap: Record<string, any> = {}
  
  if (invData) {
    invData.forEach(inv => {
      nilaiInvestasi += Number(inv.nilai_investasi || 0)
      historisProfitMitra += Number(inv.omzet_historis || 0)
      invMap[inv.outlet_id] = inv
    })
  }

  // 2. Calculate system profit
  const SYSTEM_START_DATE = '2026-08-01T00:00:00Z'
  
  let allOrders: any[] = []
  let offset = 0
  let hasMore = true
  while (hasMore) {
    const { data } = await supabase
      .from('orders')
      .select('id, outlet_id, total_amount, created_at, order_items(quantity, menu_items(hpp_override))')
      .in('outlet_id', targetOutlets)
      .eq('status', 'completed')
      .gte('created_at', SYSTEM_START_DATE)
      .range(offset, offset + 999)
      
    if (data && data.length > 0) {
      allOrders.push(...data)
      offset += 1000
      if (data.length < 1000) hasMore = false
    } else {
      hasMore = false
    }
  }
  
  let allExpenses: any[] = []
  offset = 0
  hasMore = true
  while (hasMore) {
    const { data } = await supabase
      .from('expenses')
      .select('amount, expense_date, created_at, outlet_id')
      .in('outlet_id', targetOutlets)
      .eq('type', 'out')
      .gte('created_at', SYSTEM_START_DATE)
      .range(offset, offset + 999)
      
    if (data && data.length > 0) {
      allExpenses.push(...data)
      offset += 1000
      if (data.length < 1000) hasMore = false
    } else {
      hasMore = false
    }
  }
  
  // Aggregate by outlet and month
  let systemProfitMitra = 0
  
  for (const oid of targetOutlets) {
    const inv = invMap[oid]
    const mgmtFee = inv ? Number(inv.management_fee || 0) : 0
    const isSharing = inv ? inv.is_profit_sharing_active : false
    const pct = inv ? Number(inv.persentase_bagi_hasil ?? 50) : 50
    
    const monthlyMap: Record<string, { revenue: number, cogs: number, opex: number }> = {}
    
    const outletOrders = allOrders.filter(o => o.outlet_id === oid)
    outletOrders.forEach(o => {
      const d = new Date(o.created_at)
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyMap[mk]) monthlyMap[mk] = { revenue: 0, cogs: 0, opex: 0 }
      
      monthlyMap[mk].revenue += Number(o.total_amount || 0)
      if (o.order_items) {
        o.order_items.forEach((oi: any) => {
          const qty = Number(oi.quantity || 0)
          const hpp = Number(oi.menu_items?.hpp_override || 0)
          monthlyMap[mk].cogs += qty * hpp
        })
      }
    })
    
    const outletExpenses = allExpenses.filter(e => e.outlet_id === oid)
    outletExpenses.forEach(e => {
      const dateStr = e.expense_date || e.created_at
      const d = new Date(dateStr)
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyMap[mk]) monthlyMap[mk] = { revenue: 0, cogs: 0, opex: 0 }
      
      monthlyMap[mk].opex += Number(e.amount || 0)
    })
    
    Object.keys(monthlyMap).forEach(mk => {
      const data = monthlyMap[mk]
      const netProfit = data.revenue - data.cogs - data.opex - mgmtFee
      const pMitra = isSharing ? (netProfit * (pct / 100)) : netProfit
      systemProfitMitra += pMitra
    })
  }

  const totalProfitKumulatif = historisProfitMitra + systemProfitMitra
  const roi = nilaiInvestasi > 0 ? (totalProfitKumulatif / nilaiInvestasi) * 100 : 0
  const bepPercentage = Math.min(roi, 100)
  
  return {
    systemProfitMitra,
    historisProfitMitra,
    nilaiInvestasi,
    totalProfitKumulatif,
    roi,
    bepPercentage
  }
}
