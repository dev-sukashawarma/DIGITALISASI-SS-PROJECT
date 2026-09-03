'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'

export async function getMitraRoiStats(outletId: string | 'all', allowedOutletIds: string[]) {
  const targetOutlets = outletId === 'all' ? allowedOutletIds : [outletId]
  if (targetOutlets.length === 0) {
    return {
      systemProfitMitra: 0,
      historisProfitMitra: 0,
      nilaiInvestasi: 0,
      totalProfitKumulatif: 0,
      roi: 0,
      bepPercentage: 0
    }
  }

  const bepMap = await getMitraRealtimeBepBreakdown(targetOutlets)
  
  let nilaiInvestasi = 0
  let historisProfitMitra = 0
  let systemProfitMitra = 0
  let totalDanaKembali = 0

  for (const oid of targetOutlets) {
    const item = bepMap[oid]
    if (item) {
      nilaiInvestasi += item.modalInvestasi
      historisProfitMitra += (item.omzetHistoris + item.transferHistoris)
      systemProfitMitra += item.mitraShare
      totalDanaKembali += item.totalDanaKembali
    }
  }

  const roi = nilaiInvestasi > 0 ? (totalDanaKembali / nilaiInvestasi) * 100 : 0
  const bepPercentage = Math.min(Math.round(roi * 10) / 10, 100)

  return {
    systemProfitMitra,
    historisProfitMitra,
    nilaiInvestasi,
    totalProfitKumulatif: totalDanaKembali,
    roi: Math.round(roi * 10) / 10,
    bepPercentage
  }
}

export interface MitraRealtimeBepItem {
  outletId: string
  modalInvestasi: number
  omzetHistoris: number
  transferHistoris: number
  revenue: number
  cogs: number
  opex: number
  managementFee: number
  netProfit: number
  mitraShare: number
  totalDanaKembali: number
  sisaModal: number
  roiPct: number
  bepPercentage: number
  isBep: boolean
}

export async function getMitraRealtimeBepBreakdown(mitraOutletIds: string[]): Promise<Record<string, MitraRealtimeBepItem>> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
  
  if (mitraOutletIds.length === 0) return {}

  // 1. Fetch investments, profiles, and transfers
  const [invRes, profRes, transfersRes] = await Promise.all([
    supabase.from('mitra_investments').select('*').in('outlet_id', mitraOutletIds),
    supabase.from('mitra_profiles').select('*'),
    supabase.from('mitra_transfers').select('*').in('outlet_id', mitraOutletIds)
  ])
  
  const invMap: Record<string, any> = {}
  ;(invRes.data || []).forEach(inv => {
    invMap[inv.outlet_id] = inv
  })
  
  const profiles = profRes.data || []
  const transfersData = transfersRes.data || []

  // 2. Fetch all completed orders strictly from 1 August 2026
  const SYSTEM_START_DATE = '2026-07-31T17:00:00.000Z' // 2026-08-01 00:00:00 WIB

  let allOrders: any[] = []
  let offset = 0
  while (true) {
    const { data: page, error } = await supabase
      .from('orders')
      .select('id, outlet_id, created_at, discount_amount, promo_subsidy, channel, sales_source, is_endorse, total_amount, order_items(subtotal, quantity, menu_items(hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))))')
      .in('outlet_id', mitraOutletIds)
      .eq('status', 'completed')
      .gte('created_at', SYSTEM_START_DATE)
      .range(offset, offset + 999)
      
    if (error || !page || page.length === 0) break
    allOrders.push(...page)
    if (page.length < 1000) break
    offset += 1000
  }
  
  // 3. Fetch all expenses & waste strictly from 1 August 2026
  const [
    { data: pettyExpenses },
    { data: monthlyExpenses },
    { data: wasteRows }
  ] = await Promise.all([
    supabase
      .from('petty_cash_expenses')
      .select('amount, expense_date, outlet_id')
      .in('outlet_id', mitraOutletIds)
      .is('deleted_at', null)
      .gte('expense_date', '2026-08-01'),
    supabase
      .from('expenses')
      .select('amount, expense_date, outlet_id')
      .in('outlet_id', mitraOutletIds)
      .eq('type', 'out')
      .gte('expense_date', '2026-08-01'),
    supabase.rpc('get_waste_periode', {
      p_from: '2026-08-01',
      p_to: new Date().toISOString().slice(0, 10)
    }).then(res => ({ data: res.data || [] }))
  ])

  // 4. Calculate per outlet
  const resultMap: Record<string, MitraRealtimeBepItem> = {}

function getItemHpp(menuItem: any, outletType: string = 'mitra', channel?: string | null): number {
  if (!menuItem) return 0
  let baseHpp = 0
  const normCh = channel ? channel.toLowerCase() : null
  let channelHppVal: number | null = null

  if (menuItem.channel_hpp && typeof menuItem.channel_hpp === 'object' && normCh) {
    if (
      normCh === 'ss-online' ||
      normCh === 'ss_online' ||
      normCh.includes('tiktok') ||
      normCh.includes('shopee') ||
      normCh === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' ||
      normCh === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'
    ) {
      channelHppVal = menuItem.channel_hpp.ss_online ?? menuItem.channel_hpp.tiktok_shop ?? menuItem.channel_hpp.shopee_shop ?? menuItem.channel_hpp[normCh] ?? null
    } else {
      channelHppVal = menuItem.channel_hpp[normCh] ?? null
    }
  }

  if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
    baseHpp = Number(channelHppVal)
  } else if (menuItem.hpp_override !== null && menuItem.hpp_override !== undefined && Number(menuItem.hpp_override) > 0) {
    baseHpp = Number(menuItem.hpp_override)
  } else if (menuItem.is_package && Array.isArray(menuItem.package_items)) {
    baseHpp = menuItem.package_items.reduce((sum: number, pkg: any) => {
      const compHpp = pkg.component ? getItemHpp(pkg.component, outletType, channel) : (Number(pkg.component?.hpp_override) || 0)
      const qty = Number(pkg.quantity) || 1
      return sum + (compHpp * qty)
    }, 0)
  }
  if (outletType === 'mitra' && baseHpp > 0) {
    return Math.round(baseHpp * 1.10)
  }
  return baseHpp
}

  // Try using the optimized PostgreSQL RPC first
  let rpcDataByOutlet: Record<string, { grossRevenue: number, totalDeductions: number, totalCogs: number }> = {}
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_mitra_orders_summary', {
    p_outlet_ids: mitraOutletIds,
    p_from: SYSTEM_START_DATE,
    p_to: new Date().toISOString()
  })

  if (!rpcError && rpcData && Array.isArray(rpcData)) {
    for (const row of rpcData) {
      const oid = row.outlet_id
      if (!rpcDataByOutlet[oid]) {
        rpcDataByOutlet[oid] = { grossRevenue: 0, totalDeductions: 0, totalCogs: 0 }
      }
      rpcDataByOutlet[oid].grossRevenue += Number(row.gross_revenue) || 0
      rpcDataByOutlet[oid].totalDeductions += Number(row.deductions) || 0
      rpcDataByOutlet[oid].totalCogs += Number(row.cogs) || 0
    }
  }

  for (const oid of mitraOutletIds) {
    const inv = invMap[oid]
    const profile = profiles.find(p => (p.outlet_ids || []).includes(oid))
    let pct = inv?.persentase_bagi_hasil ?? profile?.profit_sharing_pct ?? 50
    const modalInvestasi = Number(inv?.nilai_investasi) || 0
    const omzetHistoris = Number(inv?.omzet_historis) || 0
    const transferHistoris = Number(inv?.transfer_historis) || 0
    const mgmtFeePct = Number(inv?.management_fee) || 0
    const systemTransfers = transfersData.filter(t => t.outlet_id === oid).reduce((sum, t) => sum + (Number(t.nominal) || 0), 0)

    // JIKA SUDAH BEP 100%, maka keuntungan antara mitra dan pusat jadi 50:50
    if (modalInvestasi > 0 && (omzetHistoris + transferHistoris + systemTransfers) >= modalInvestasi) {
      pct = 50
    }

    let grossRevenue = 0
    let totalDeductions = 0
    let totalCogs = 0

    if (!rpcError && rpcData && Array.isArray(rpcData)) {
      if (rpcDataByOutlet[oid]) {
        grossRevenue = rpcDataByOutlet[oid].grossRevenue
        totalDeductions = rpcDataByOutlet[oid].totalDeductions
        totalCogs = rpcDataByOutlet[oid].totalCogs
      }
    } else {
      const outletOrders = allOrders.filter(o => o.outlet_id === oid)
      outletOrders.forEach(order => {
        const totalAmt = Number(order.total_amount) || 0
        const disc = Number(order.discount_amount) || 0
        const promo = Number(order.promo_subsidy) || 0

        let itemGross = 0
        let orderCogs = 0

        if (Array.isArray(order.order_items)) {
          for (const item of order.order_items) {
            const qty = Number(item.quantity) || 1
            itemGross += Number(item.subtotal) || (qty * Number(item.unit_price || 0)) || 0

            const hpp = getItemHpp(item.menu_items, 'mitra', order.channel)
            orderCogs += (hpp * qty)
          }
        }

        const itemDiff = itemGross > totalAmt ? itemGross - totalAmt : 0
        const extraDiff = Math.max(0, itemDiff - (disc + promo))
        const deductions = disc + promo + extraDiff
        const grossRev = itemGross > 0 ? itemGross : (totalAmt + disc + promo)

        grossRevenue += grossRev
        totalDeductions += deductions
        totalCogs += orderCogs
      })
    }

    const opex = (pettyExpenses?.filter(p => p.outlet_id === oid).reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0) +
                 (monthlyExpenses?.filter(m => m.outlet_id === oid).reduce((sum, m) => sum + Number(m.amount || 0), 0) || 0)

    const waste = wasteRows?.filter((w: any) => w.outlet_id === oid).reduce((sum: number, w: any) => sum + Number(w.nilai_waste || 0), 0) || 0

    const managementFee = (grossRevenue * mgmtFeePct) / 100
    const netProfit = grossRevenue - totalDeductions - totalCogs - opex - waste - managementFee
    const mitraShare = netProfit > 0 ? (netProfit * pct) / 100 : 0

    const totalDanaKembali = omzetHistoris + transferHistoris + mitraShare
    const roiPct = modalInvestasi > 0 ? (totalDanaKembali / modalInvestasi) * 100 : 0
    const bepPercentage = Math.min(Math.round(roiPct * 10) / 10, 100)
    const isBep = modalInvestasi > 0 && totalDanaKembali >= modalInvestasi
    const sisaModal = Math.max(0, modalInvestasi - totalDanaKembali)

    resultMap[oid] = {
      outletId: oid,
      modalInvestasi,
      omzetHistoris,
      transferHistoris,
      revenue: grossRevenue,
      cogs: totalCogs,
      opex: opex + waste,
      managementFee,
      netProfit,
      mitraShare,
      totalDanaKembali,
      sisaModal,
      roiPct,
      bepPercentage,
      isBep
    }
  }

  return resultMap
}

