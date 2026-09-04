'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { PeriodFilterValue } from '@/lib/types'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'
import { fetchAllPages } from '@/lib/fetchAllPages'
import { cleanItemName } from '@/lib/order-item-name'
import { resolveMitraPolicy } from '@/lib/mitraPolicy'

export interface ChannelPnlDetail {
  revenue: number
  cogs: number
  deductions: number // Platform fees + merchant discounts
  grossProfit: number
  orderCount: number
}

export interface OpexCategoryDetail {
  category: string
  amount: number
  items: { description: string; amount: number; date: string; source: 'petty_cash' | 'monthly' }[]
}

export interface ComprehensiveMitraPnl {
  period: {
    from: string
    to: string
  }
  outletName: string
  profitSharingPct: number
  summary: {
    grossRevenue: number
    totalDeductions: number
    netRevenue: number
    totalCogs: number
    grossProfit: number
    totalOpex: number
    totalWaste: number
    managementFeePct?: number
    managementFeeAmount?: number
    netProfit: number
    mitraShare: number
    profitMarginPct: number
    policyStatus?: string
    isBep?: boolean
  }
  channels: {
    pos: ChannelPnlDetail
    foodApps: ChannelPnlDetail & { grab: number; gofood: number; shopeefood: number }
    tiktok: ChannelPnlDetail
  }
  opex: {
    categories: OpexCategoryDetail[]
    totalPettyCash: number
    totalMonthly: number
    grandTotal: number
  }
  investment: {
    totalModal: number
    totalProfitDistributed: number
    bepPercentage: number
    roi: number
  }
}

export async function getMitraComprehensivePnl(
  filter: PeriodFilterValue,
  selectedOutletId: string,
  allowedOutletIds: string[]
): Promise<ComprehensiveMitraPnl> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Security check: restrict target outlet IDs to what the partner actually owns
  const targetOutletIds = selectedOutletId === 'all' 
    ? allowedOutletIds 
    : allowedOutletIds.filter(id => id === selectedOutletId)

  if (targetOutletIds.length === 0) {
    return {
      period: { from: filter.from || '', to: filter.to || '' },
      outletName: 'Outlet Tidak Ditemukan',
      profitSharingPct: 50,
      summary: {
        grossRevenue: 0,
        totalDeductions: 0,
        netRevenue: 0,
        totalCogs: 0,
        grossProfit: 0,
        totalOpex: 0,
        totalWaste: 0,
        managementFeePct: 0,
        managementFeeAmount: 0,
        netProfit: 0,
        mitraShare: 0,
        profitMarginPct: 0
      },
      channels: {
        pos: { revenue: 0, cogs: 0, deductions: 0, grossProfit: 0, orderCount: 0 },
        foodApps: { revenue: 0, cogs: 0, deductions: 0, grossProfit: 0, orderCount: 0, grab: 0, gofood: 0, shopeefood: 0 },
        tiktok: { revenue: 0, cogs: 0, deductions: 0, grossProfit: 0, orderCount: 0 }
      },
      opex: { categories: [], totalPettyCash: 0, totalMonthly: 0, grandTotal: 0 },
      investment: { totalModal: 0, totalProfitDistributed: 0, bepPercentage: 0, roi: 0 }
    }
  }

  // 1. Date ranges
  const fromStart = new Date(`${filter.from}T00:00:00.000+07:00`)
  const toEnd = new Date(`${filter.to}T23:59:59.999+07:00`)

  // 2. Fetch all Profile, Outlets, Investments, Transfers, Expenses, Waste, and RPC Orders Summary in parallel
  const [
    profileRes,
    outletListRes,
    investmentsRes,
    transfersRes,
    pettyExpensesRes,
    monthlyExpensesRes,
    wasteRowsRes,
    rpcRes
  ] = await Promise.all([
    supabase.from('mitra_profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('outlets').select('id, name').in('id', targetOutletIds),
    supabase.from('mitra_investments').select('*').in('outlet_id', targetOutletIds),
    supabase.from('mitra_transfers').select('*').in('outlet_id', targetOutletIds),
    supabase
      .from('petty_cash_expenses')
      .select('id, amount, expense_date, category, description, outlet_id')
      .in('outlet_id', targetOutletIds)
      .neq('outlet_id', TEST_OUTLET_ID)
      .is('deleted_at', null)
      .gte('expense_date', filter.from)
      .lte('expense_date', filter.to),
    supabase
      .from('expenses')
      .select('id, amount, expense_date, category, description, outlet_id, type')
      .in('outlet_id', targetOutletIds)
      .neq('outlet_id', TEST_OUTLET_ID)
      .eq('type', 'expense')
      .gte('expense_date', filter.from)
      .lte('expense_date', filter.to),
    supabase.rpc('get_waste_periode', {
      p_from: filter.from,
      p_to: filter.to,
    }).then(res => ({ data: (res.data || []).filter((r: any) => targetOutletIds.includes(r.outlet_id)) })),
    supabase.rpc('get_mitra_orders_summary', {
      p_outlet_ids: targetOutletIds,
      p_from: fromStart.toISOString(),
      p_to: toEnd.toISOString()
    })
  ])

  const profile = profileRes.data
  const outletList = outletListRes.data
  const investments = investmentsRes.data
  const transfers = transfersRes.data
  const pettyExpenses = pettyExpensesRes.data
  const monthlyExpenses = monthlyExpensesRes.data
  const wasteRows = wasteRowsRes.data
  const { data: rpcData, error: rpcError } = rpcRes

  // Penentuan persentase bagi hasil kini lewat resolveMitraPolicy() di bawah
  // (per-outlet, sadar BEP & cutoff September 2026). Blok lama yang menghitung
  // `profitSharingPct` di sini sudah tidak dibaca siapa pun sejak 407749ad.

  const outletName = selectedOutletId === 'all'
    ? (targetOutletIds.length > 1 ? `Semua Outlet (${targetOutletIds.length})` : (outletList?.[0]?.name || 'Semua Outlet'))
    : (outletList?.find(o => o.id === selectedOutletId)?.name || 'Outlet')

  // Fallback query builder (used ONLY if RPC fails)
  const buildOrdersQuery = () => supabase
    .from('orders')
    .select('id, outlet_id, created_at, discount_amount, promo_subsidy, channel, sales_source, is_endorse, total_amount, order_items(subtotal, quantity, menu_item_name, menu_items(hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))))')
    .in('outlet_id', targetOutletIds)
    .neq('outlet_id', TEST_OUTLET_ID)
    .eq('status', 'completed')
    .gte('created_at', fromStart.toISOString())
    .lte('created_at', toEnd.toISOString())
    .order('id', { ascending: true })

  // 4. Process Channel Breakdown & COGS
  let posGross = 0
  let posDeductions = 0
  let posCogs = 0
  let posCount = 0

  let faGross = 0
  let faDeductions = 0
  let faCogs = 0
  let faCount = 0
  let grabRev = 0
  let gofoodRev = 0
  let shopeeRev = 0

  let tkGross = 0
  let tkDeductions = 0
  let tkCogs = 0
  let tkCount = 0

  const outletGrossRevMap = new Map<string, number>()
  const outletFinancialsMap = new Map<string, { gross: number; deductions: number; cogs: number }>()

  if (!rpcError && rpcData && Array.isArray(rpcData)) {
    // We successfully retrieved the pre-aggregated data from the database
    for (const row of rpcData) {
      const gross = Number(row.gross_revenue) || 0
      const ded = Number(row.deductions) || 0
      const cogs = Number(row.cogs) || 0
      const count = Number(row.order_count) || 0

      outletGrossRevMap.set(row.outlet_id, (outletGrossRevMap.get(row.outlet_id) || 0) + gross)

      const curFin = outletFinancialsMap.get(row.outlet_id) || { gross: 0, deductions: 0, cogs: 0 }
      curFin.gross += gross
      curFin.deductions += ded
      curFin.cogs += cogs
      outletFinancialsMap.set(row.outlet_id, curFin)

      if (row.channel_group === 'foodApps') {
        faGross += gross
        faDeductions += ded
        faCogs += cogs
        faCount += count
        grabRev += Number(row.grab_rev) || 0
        gofoodRev += Number(row.gofood_rev) || 0
        shopeeRev += Number(row.shopee_rev) || 0
      } else if (row.channel_group === 'tiktok') {
        tkGross += gross
        tkDeductions += ded
        tkCogs += cogs
        tkCount += count
      } else {
        posGross += gross
        posDeductions += ded
        posCogs += cogs
        posCount += count
      }
    }
  } else {
    // Fallback to memory-heavy JavaScript processing if RPC doesn't exist yet

    // HPP dasar, TANPA markup mitra. Rekursi paket memakai fungsi ini juga,
    // supaya komponen tidak ter-markup lebih dulu lalu ter-markup lagi di
    // lapisan paket (dulu paket kena 1,21 alih-alih 1,10).
    function getItemHppBase(menuItem: any, channel?: string | null): number {
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
          const compHpp = pkg.component ? getItemHppBase(pkg.component, channel) : 0
          const qty = Number(pkg.quantity) || 1
          return sum + (compHpp * qty)
        }, 0)
      }
      return baseHpp
    }

    // Markup mitra 10% diterapkan SEKALI, di lapisan terluar.
    function getItemHpp(menuItem: any, outletType: string = 'mitra', channel?: string | null): number {
      const baseHpp = getItemHppBase(menuItem, channel)
      if (outletType === 'mitra' && baseHpp > 0) {
        return Math.round(baseHpp * 1.10)
      }
      return Math.round(baseHpp)
    }

    // Error saat paginasi TIDAK boleh ditelan: sebelumnya `break` diam-diam
    // membuat data separuh dipakai seolah lengkap, sehingga laba mitra
    // dilaporkan terlalu kecil tanpa gejala apa pun.
    const allOrders = await fetchAllPages<any>(buildOrdersQuery)

    // Cadangan HPP lewat NAMA menu: jalur pemesanan web menyimpan order_items
    // tanpa `menu_item_id`, sehingga lookup lewat id menghasilkan 0 dan biaya
    // bahannya hilang dari laba mitra. Pola sama dengan useHpp.ts di dashboard
    // Owner. Dipakai HANYA saat lookup id gagal.
    const { data: menuList } = await supabase
      .from('menu_items')
      .select('id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))')
    const menuByName = new Map<string, any>()
    for (const m of menuList ?? []) {
      if (m?.name) menuByName.set(cleanItemName(m.name).trim().toLowerCase(), m)
    }
    const hppByName = (rawName?: string | null, channel?: string | null): number => {
      if (!rawName) return 0
      const m = menuByName.get(cleanItemName(rawName).trim().toLowerCase())
      return m ? getItemHpp(m, 'mitra', channel) : 0
    }

    for (const ord of allOrders) {
      const totalAmt = Number(ord.total_amount) || 0
      const disc = Number(ord.discount_amount) || 0
      const promo = Number(ord.promo_subsidy) || 0
      const ch = (ord.channel || 'pos').toLowerCase()
      const src = (ord.sales_source || ch).toLowerCase()

      let orderCogs = 0

      if (Array.isArray(ord.order_items)) {
        for (const item of ord.order_items) {
          const qty = Number(item.quantity) || 1
          const hpp = getItemHpp(item.menu_items, 'mitra', ord.channel)
            || hppByName(item.menu_item_name, ord.channel)
          orderCogs += (hpp * qty)
        }
      }

      // Acuan omzet kanonik, sama dengan sales_daily_spv & dashboard Owner.
      // Baris order_items TIDAK dipakai sebagai omzet: untuk order food-apps,
      // `promo_subsidy` tak pernah tercermin di sana (SUM(subtotal) justru sama
      // persis dengan total_amount), sehingga tambalan `extraDiff` yang dulu ada
      // hanya menciptakan potongan palsu.
      const deductions = disc + promo
      const grossRev = totalAmt + disc + promo

      outletGrossRevMap.set(ord.outlet_id, (outletGrossRevMap.get(ord.outlet_id) || 0) + grossRev)

      const curFin = outletFinancialsMap.get(ord.outlet_id) || { gross: 0, deductions: 0, cogs: 0 }
      curFin.gross += grossRev
      curFin.deductions += deductions
      curFin.cogs += orderCogs
      outletFinancialsMap.set(ord.outlet_id, curFin)

      if (
        src.includes('tiktok') ||
        ch.includes('tiktok') ||
        ch === 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8' ||
        ch === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5'
      ) {
        tkGross += grossRev
        tkDeductions += deductions
        tkCogs += orderCogs
        tkCount++
      } else if (
        src.includes('grab') ||
        src.includes('gofood') ||
        src.includes('go_food') ||
        src.includes('gojek') ||
        src.includes('shopee') ||
        src === 'food_delivery' ||
        src === 'food_apps' ||
        src === 'foodapps' ||
        ch.includes('grab') ||
        ch.includes('gofood') ||
        ch.includes('go_food') ||
        ch.includes('gojek') ||
        ch.includes('shopee') ||
        ch === 'food_apps' ||
        ch === 'foodapps' ||
        ch === '1284ac2a-e753-4380-9f32-59219a322459' ||
        ch === '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a' ||
        ch === '0eaf2746-da9f-492c-a9b4-f091307c98c2'
      ) {
        faGross += grossRev
        faDeductions += deductions
        faCogs += orderCogs
        faCount++
        if (src.includes('grab') || ch.includes('grab') || ch === '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a') grabRev += totalAmt
        else if (src.includes('gofood') || src.includes('go_food') || src.includes('gojek') || ch.includes('gofood') || ch.includes('go_food') || ch.includes('gojek') || ch === '1284ac2a-e753-4380-9f32-59219a322459') gofoodRev += totalAmt
        else if (src.includes('shopee') || ch.includes('shopee') || ch === '0eaf2746-da9f-492c-a9b4-f091307c98c2') shopeeRev += totalAmt
      } else {
        // Default to POS (Dine-in, Takeaway, QRIS, Kasir)
        posGross += grossRev
        posDeductions += deductions
        posCogs += orderCogs
        posCount++
      }
    }
  }

  // 6. Process OPEX Categories
  const categoryMap = new Map<string, { amount: number; items: any[] }>()

  const toTitleCase = (str: string): string => {
    if (!str) return 'Biaya Operasional Lainnya'
    return str
      .replace(/[_-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .map(word => {
        const lower = word.toLowerCase()
        if (['dan', 'di', 'ke', 'per', 'atau'].includes(lower)) return lower
        if (['pos', 'qris', 'pks', 'nik', 'ktp', 'bep', 'hpp', 'pln', 'pdam', 'opex'].includes(lower)) return lower.toUpperCase()
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      })
      .join(' ')
  }

  const mapToStandardCategory = (rawCat?: string, desc?: string): string => {
    const text = `${rawCat || ''} ${desc || ''}`.toLowerCase()
    
    // Explicit raw code aliases
    const rawLower = (rawCat || '').trim().toLowerCase()
    if (rawLower === 'bb' || rawLower === 'bahan_baku' || rawLower === 'bahan baku') {
      return 'Bahan Habis Pakai & Operasional Harian'
    }
    if (rawLower === 'outlet' || rawLower === 'pengeluaran_outlet' || rawLower === 'operasional_outlet') {
      return 'Operasional & Perlengkapan Outlet'
    }
    if (rawLower === 'overtime') {
      return 'Gaji, Lembur & Upah Crew'
    }

    if (text.includes('gaji') || text.includes('crew') || text.includes('lembur') || text.includes('overtime') || text.includes('bonus') || text.includes('korlap') || text.includes('salary')) {
      return 'Gaji, Lembur & Upah Crew'
    }
    if (text.includes('pln') || text.includes('listrik') || text.includes('pdam') || text.includes('air') || text.includes('internet') || text.includes('wifi') || text.includes('utilitas')) {
      return 'Utilitas (Listrik, Air & Internet)'
    }
    if (text.includes('gas') || text.includes('es') || text.includes('minyak') || text.includes('bumbu') || text.includes('kantong') || text.includes('cup') || text.includes('packaging') || text.includes('kresek') || text.includes('habis pakai') || text.includes('operasional')) {
      return 'Bahan Habis Pakai & Operasional Harian'
    }
    if (text.includes('maintenance') || text.includes('service') || text.includes('perbaikan') || text.includes('alat') || text.includes('servis') || text.includes('renovasi')) {
      return 'Pemeliharaan & Perbaikan Alat'
    }
    if (text.includes('sewa') || text.includes('kontrak') || text.includes('gedung') || text.includes('lapak') || text.includes('lahan')) {
      return 'Sewa Tempat & Lokasi'
    }
    if (text.includes('promo') || text.includes('ads') || text.includes('endorse') || text.includes('marketing') || text.includes('banner') || text.includes('iklan')) {
      return 'Marketing & Promosi Outlet'
    }
    if (text.includes('kebersihan') || text.includes('cleaning') || text.includes('sampah') || text.includes('sabun')) {
      return 'Kebersihan & Sanitasi Outlet'
    }
    if (text.includes('transport') || text.includes('bensin') || text.includes('ojol') || text.includes('ongkir') || text.includes('kurir')) {
      return 'Transport & Logistik Outlet'
    }

    return rawCat ? toTitleCase(rawCat) : 'Biaya Operasional Lainnya'
  }

  const outletOpexMap = new Map<string, number>()
  let totalPettyCash = 0
  if (pettyExpenses) {
    for (const p of pettyExpenses) {
      const amt = Number(p.amount) || 0
      totalPettyCash += amt
      if (p.outlet_id) {
        outletOpexMap.set(p.outlet_id, (outletOpexMap.get(p.outlet_id) || 0) + amt)
      }
      const cat = mapToStandardCategory(p.category, p.description)
      const existing = categoryMap.get(cat) || { amount: 0, items: [] }
      existing.amount += amt
      existing.items.push({
        description: p.description || p.category || 'Kas Kecil',
        amount: amt,
        date: p.expense_date,
        source: 'petty_cash'
      })
      categoryMap.set(cat, existing)
    }
  }

  let totalMonthly = 0
  if (monthlyExpenses) {
    for (const m of monthlyExpenses) {
      const amt = Number(m.amount) || 0
      totalMonthly += amt
      if (m.outlet_id) {
        outletOpexMap.set(m.outlet_id, (outletOpexMap.get(m.outlet_id) || 0) + amt)
      }
      const cat = mapToStandardCategory(m.category, m.description)
      const existing = categoryMap.get(cat) || { amount: 0, items: [] }
      existing.amount += amt
      existing.items.push({
        description: m.description || m.category || 'Pengeluaran Bulanan',
        amount: amt,
        date: m.expense_date,
        source: 'monthly'
      })
      categoryMap.set(cat, existing)
    }
  }

  const opexCategories: OpexCategoryDetail[] = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      items: data.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }))
    .sort((a, b) => b.amount - a.amount)

  const grandTotalOpex = totalPettyCash + totalMonthly

  // 7. Waste
  const outletWasteMap = new Map<string, number>()
  let totalWaste = 0
  if (wasteRows) {
    for (const w of wasteRows) {
      const amt = Number(w.nilai_waste) || 0
      totalWaste += amt
      if (w.outlet_id) {
        outletWasteMap.set(w.outlet_id, (outletWasteMap.get(w.outlet_id) || 0) + amt)
      }
    }
  }

  // 8. Financial Totals
  const totalGrossRevenue = posGross + faGross + tkGross
  const totalDeductions = posDeductions + faDeductions + tkDeductions
  const netRevenue = Math.max(0, totalGrossRevenue - totalDeductions)
  const totalCogs = posCogs + faCogs + tkCogs
  const grossProfit = netRevenue - totalCogs

  // 8b. Per-Outlet Policy Evaluation, Management Fee & Profit Sharing (Adaptive BEP Scheme)
  const invMap = new Map((investments || []).map(i => [i.outlet_id, i]))
  let totalManagementFeeAmount = 0
  let totalMitraShare = 0
  let singlePolicyStatus = ''
  let singleIsBep = false
  let singleManagementFeePct = 0
  let singleProfitSharingPct = 50

  for (const oid of targetOutletIds) {
    const inv = invMap.get(oid)
    const modalInvestasi = Number(inv?.nilai_investasi) || 0
    const omzetHistoris = Number(inv?.omzet_historis) || 0
    const transferHistoris = Number(inv?.transfer_historis) || 0
    const outletTransfers = (transfers || []).filter(t => t.outlet_id === oid).reduce((s, t) => s + (Number(t.nominal) || 0), 0)
    const totalDanaKembali = omzetHistoris + transferHistoris + outletTransfers
    const isOutletBep = modalInvestasi > 0 && totalDanaKembali >= modalInvestasi

    const legacyShare = Number(inv?.persentase_bagi_hasil) || Number(profile?.profit_sharing_pct) || 50
    const legacyFee = Number(inv?.management_fee) || 0

    const policy = resolveMitraPolicy({
      periodFrom: filter.from,
      isBep: isOutletBep,
      legacyProfitSharingPct: legacyShare,
      legacyManagementFee: legacyFee
    })

    const fin = outletFinancialsMap.get(oid) || { gross: 0, deductions: 0, cogs: 0 }
    const opex = outletOpexMap.get(oid) || 0
    const waste = outletWasteMap.get(oid) || 0

    let mgmtFee = 0
    if (policy.managementFeePct > 0) {
      mgmtFee = Math.round((fin.gross * policy.managementFeePct) / 100)
    }

    const outletNetProfit = fin.gross - fin.deductions - fin.cogs - opex - waste - mgmtFee
    const outletMitraShare = outletNetProfit > 0 ? Math.round((outletNetProfit * policy.profitSharingPct) / 100) : 0

    totalManagementFeeAmount += mgmtFee
    totalMitraShare += outletMitraShare

    if (targetOutletIds.length === 1) {
      singlePolicyStatus = policy.statusLabel
      singleIsBep = policy.isBep
      singleManagementFeePct = policy.managementFeePct
      singleProfitSharingPct = policy.profitSharingPct
    }
  }

  const managementFeeAmount = Math.round(totalManagementFeeAmount)
  const netProfit = grossProfit - grandTotalOpex - totalWaste - managementFeeAmount
  const mitraShare = totalMitraShare
  const profitMarginPct = totalGrossRevenue > 0 ? (netProfit / totalGrossRevenue) * 100 : 0

  // 9. Investment & Historical BEP Stats (Konsolidasi Jaringan)
  let totalModal = 0
  let totalOmzetHistoris = 0
  let totalTransferHistoris = 0
  if (investments) {
    totalModal = investments.reduce((sum, inv) => sum + (Number(inv.nilai_investasi) || 0), 0)
    totalOmzetHistoris = investments.reduce((sum, inv) => sum + (Number(inv.omzet_historis) || 0), 0)
    totalTransferHistoris = investments.reduce((sum, inv) => sum + (Number(inv.transfer_historis) || 0), 0)
  }

  let totalTransfers = 0
  if (transfers) {
    totalTransfers = transfers.reduce((sum, t) => sum + (Number(t.nominal) || 0), 0)
  }

  const totalProfitDistributed = totalOmzetHistoris + totalTransferHistoris + totalTransfers
  const roi = totalModal > 0 ? (totalProfitDistributed / totalModal) * 100 : 0
  const bepPercentage = Math.min(roi, 100)
  const isGlobalBep = totalModal > 0 && totalProfitDistributed >= totalModal

  const finalProfitSharingPct = targetOutletIds.length === 1
    ? singleProfitSharingPct
    : (netProfit > 0 ? Math.round((mitraShare / netProfit) * 100) : 50)

  const finalManagementFeePct = targetOutletIds.length === 1
    ? singleManagementFeePct
    : (totalGrossRevenue > 0 ? Math.round((managementFeeAmount / totalGrossRevenue) * 100 * 10) / 10 : 3)

  const finalPolicyStatus = targetOutletIds.length === 1
    ? singlePolicyStatus
    : 'Agregasi Jaringan Kemitraan'

  const finalIsBep = targetOutletIds.length === 1
    ? singleIsBep
    : isGlobalBep

  return {
    period: {
      from: filter.from || '',
      to: filter.to || ''
    },
    outletName,
    profitSharingPct: finalProfitSharingPct,
    summary: {
      grossRevenue: totalGrossRevenue,
      totalDeductions,
      netRevenue,
      totalCogs,
      grossProfit,
      totalOpex: grandTotalOpex,
      totalWaste,
      managementFeePct: finalManagementFeePct,
      managementFeeAmount,
      netProfit,
      mitraShare,
      profitMarginPct,
      policyStatus: finalPolicyStatus,
      isBep: finalIsBep
    },
    channels: {
      pos: {
        revenue: posGross,
        cogs: posCogs,
        deductions: posDeductions,
        grossProfit: (posGross - posDeductions) - posCogs,
        orderCount: posCount
      },
      foodApps: {
        revenue: faGross,
        cogs: faCogs,
        deductions: faDeductions,
        grossProfit: (faGross - faDeductions) - faCogs,
        orderCount: faCount,
        grab: grabRev,
        gofood: gofoodRev,
        shopeefood: shopeeRev
      },
      tiktok: {
        revenue: tkGross,
        cogs: tkCogs,
        deductions: tkDeductions,
        grossProfit: (tkGross - tkDeductions) - tkCogs,
        orderCount: tkCount
      }
    },
    opex: {
      categories: opexCategories,
      totalPettyCash,
      totalMonthly,
      grandTotal: grandTotalOpex
    },
    investment: {
      totalModal,
      totalProfitDistributed,
      bepPercentage,
      roi
    }
  }
}
