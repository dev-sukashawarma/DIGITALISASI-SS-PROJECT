'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { createServiceClient } from '@/lib/supabase/server'
import type { PeriodFilterValue } from '@/lib/types'
import { TEST_OUTLET_ID, isExcludedOutlet } from '@/lib/outletFilters'
import { fetchAllPages } from '@/lib/fetchAllPages'
import { cleanItemName } from '@/lib/order-item-name'
import { resolveMitraPolicy, calculateMitraBepStatus } from '@/lib/mitraPolicy'
import { getMitraAugustClosing, isAugust2026Period } from './mitraPnlClosingData'
import { ambilRiwayatHpp, buatPenerapRiwayat, tanggalWib } from '@/lib/hpp/riwayatHpp'
import { fetchHppRows, type HppRow } from '@/lib/hpp/fetchHpp'
import { adalahKanalSsOnline } from '@/lib/hpp/kanalSsOnline'
import { buatSaringanKasKecil } from '@/lib/kasKecilTeraudit'
import {
  calculateProratedExpenses,
  getPeriodsInRange,
  calculateMonthOverlap,
  type ManagerAssignment,
} from '@/lib/opexProrata'
import { monthRange } from '@/lib/period'
import { isTestOrDevStaff, KANTOR_PUSAT_ID } from '@/lib/staffFilters'

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
    /** `false` bila `mitra_investments.is_profit_sharing_active` dimatikan owner. */
    profitSharingActive?: boolean
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
  const authClient = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const userId = await getVerifiedUserId(authClient)
  if (!userId) throw new Error('Unauthorized')

  // Bypasses RLS to ensure accurate calculations across partner profiles, investments, and expenses
  const supabase = createServiceClient()

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

  // 1. Date ranges & periods
  const fromStart = new Date(`${filter.from}T00:00:00.000+07:00`)
  const toEnd = new Date(`${filter.to}T23:59:59.999+07:00`)
  const periods = getPeriodsInRange(filter.from, filter.to)
  const months = [...new Set(periods.map(p => p.month))]
  const years = [...new Set(periods.map(p => p.year))]

  const overlap = calculateMonthOverlap(filter.from, filter.to)
  const prevMonth = overlap.month === 1 ? 12 : overlap.month - 1
  const prevYear = overlap.month === 1 ? overlap.year - 1 : overlap.year
  const prevMonthRange = monthRange(prevYear, prevMonth)
  const shouldFetchRollover = overlap.isCurrentMonth && overlap.overlapDays > 0

  // 2. Fetch all Profile, Outlets, Investments, Transfers, Expenses, Waste, Payroll, Bonuses, and RPC Orders Summary in parallel
  const [
    profileRes,
    outletListRes,
    investmentsRes,
    transfersRes,
    pettyExpensesRes,
    monthlyExpensesRes,
    wasteRowsRes,
    rpcRes,
    settlementsRes,
    payrollRes,
    staffRes,
    bonusRes,
    lastMonthExpRes,
    salesDailyRes,
    managerStaffRes,
    allOpOutletsRes,
    hppRowsRes
  ] = await Promise.all([
    supabase.from('mitra_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('outlets').select('id, name, is_active').in('id', targetOutletIds),
    supabase.from('mitra_investments').select('*').in('outlet_id', targetOutletIds),
    supabase.from('mitra_transfers').select('*').in('outlet_id', targetOutletIds),
    // OPEX WAJIB dipaginasi: PostgREST memotong di 1.000 baris tanpa error,
    // dan OPEX yang terpotong membuat laba (dan bagi hasil) terlalu besar.
    fetchAllPages<any>(() => supabase
      .from('petty_cash_expenses')
      .select('id, amount, expense_date, category, description, outlet_id')
      .in('outlet_id', targetOutletIds)
      .neq('outlet_id', TEST_OUTLET_ID)
      .is('deleted_at', null)
      .gte('expense_date', filter.from)
      .lte('expense_date', filter.to)
      .order('id', { ascending: true })
    ).then(rows => ({ data: rows })),
    fetchAllPages<any>(() => supabase
      .from('expenses')
      .select('id, amount, expense_date, category, description, outlet_id, type')
      .in('outlet_id', targetOutletIds)
      .neq('outlet_id', TEST_OUTLET_ID)
      .eq('type', 'expense')
      .gte('expense_date', filter.from)
      .lte('expense_date', filter.to)
      .order('id', { ascending: true })
    ).then(rows => ({ data: rows })),
    supabase.rpc('get_waste_periode', {
      p_from: filter.from,
      p_to: filter.to,
    }).then(async res => {
      let data = (res.data || []).filter((r: any) => targetOutletIds.includes(r.outlet_id))
      if (!data || data.length === 0) {
        const { data: directReports } = await supabase
          .from('stok_waste_reports')
          .select('outlet_id, qty, bahan_baku_id')
          .in('outlet_id', targetOutletIds)
          .eq('status', 'APPROVED')
          .gte('created_at', `${filter.from}T00:00:00+07:00`)
          .lte('created_at', `${filter.to}T23:59:59+07:00`)
        if (directReports && directReports.length > 0) {
          const { data: prices } = await supabase.from('bahan_baku_harga').select('bahan_baku_id, harga_beli')
          const pMap = new Map((prices || []).map((p: any) => [p.bahan_baku_id, Number(p.harga_beli) || 0]))
          const sumMap = new Map<string, number>()
          for (const dr of directReports) {
            const h = pMap.get(dr.bahan_baku_id) || 0
            sumMap.set(dr.outlet_id, (sumMap.get(dr.outlet_id) || 0) + ((Number(dr.qty) || 0) * h))
          }
          data = Array.from(sumMap.entries()).map(([outlet_id, nilai_waste]) => ({ outlet_id, nilai_waste }))
        }
      }
      return { data }
    }),
    supabase.rpc('get_mitra_orders_summary', {
      p_outlet_ids: targetOutletIds,
      p_from: fromStart.toISOString(),
      p_to: toEnd.toISOString()
    }),
    // Semua rekonsiliasi platform settlement (GoFood, GrabFood, ShopeeFood, TikTok Go)
    // untuk komisi platform (platform fee) & rekonsiliasi promo merchant
    fetchAllPages<any>(() => supabase
      .from('platform_settlements')
      .select('outlet_id, platform, omzet_kotor, promo_merchant, commission, tanggal')
      .in('outlet_id', targetOutletIds)
      .gte('tanggal', filter.from)
      .lte('tanggal', filter.to)
      .order('id', { ascending: true })
    ).then(rows => ({ data: rows })).catch(err => {
      console.warn('Gagal memuat platform_settlements di mitraPnl:', err)
      return { data: [] as any[] }
    }),
    // Slip gaji HR (payroll_records) untuk sinkronisasi dengan Tab Laba Rugi
    supabase
      .from('payroll_records')
      .select(`
        period_month,
        period_year,
        outlet_id,
        total_salary,
        basic_salary,
        bonus,
        allowance_position,
        allowance_presence,
        outlet_staff!payroll_records_staff_id_fkey(
          id,
          name,
          username,
          outlet_id,
          role,
          status,
          account_category
        )
      `)
      .in('period_year', years.length > 0 ? years : [new Date().getFullYear()])
      .in('period_month', months.length > 0 ? months : [new Date().getMonth() + 1]),
    // Fallback master staf aktif
    supabase
      .from('outlet_staff')
      .select(`
        id,
        name,
        username,
        outlet_id,
        role,
        status,
        account_category,
        staff_financials(
          basic_salary,
          allowance_position,
          allowance_presence
        )
      `)
      .eq('status', 'active')
      .in('role', ['crew', 'leader', 'kasir', 'kitchen', 'driver'])
      .in('outlet_id', targetOutletIds),
    // Bonus crew via RPC
    Promise.all(
      (periods.length > 0 ? periods : [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]).map(async ym => {
        const { data } = await supabase.rpc('get_monthly_crew_bonus', {
          p_month: ym.month,
          p_year: ym.year,
          p_outlet_id: null
        })
        return (data ?? []).map((r: any) => ({
          crew_id: r.crew_id as string,
          outlet_id: r.outlet_id as string,
          outlet_name: r.outlet_name as string,
          total_pcs_outlet: Number(r.total_pcs_outlet) || 0,
          total_bonus: Number(r.total_bonus) || 0,
          period_month: ym.month,
          period_year: ym.year,
        }))
      })
    ).then(res => res.flat()),
    // Beban rollover bulan sebelumnya (sewa, internet, bonus) untuk akrual harian bulan berjalan
    shouldFetchRollover
      ? supabase
          .from('expenses')
          .select('outlet_id, category, amount')
          .in('category', [
            'sewa_outlet', 'sewa',
            'internet', 'wifi',
            'bonus_crew', 'bonus_leader',
            'bonus_area_manager', 'bonus_regional_manager', 'bonus_korlap',
          ])
          .in('outlet_id', targetOutletIds)
          .eq('type', 'expense')
          .gte('expense_date', prevMonthRange.from)
          .lte('expense_date', prevMonthRange.to)
      : Promise.resolve({ data: [] as any[] }),
    // Ringkasan penjualan harian per outlet x sumber dari view DB `sales_daily_scoped`
    // Menjadi Single Source of Truth untuk Omzet Kotor & Potongan agar 100%
    // sinkron dengan Tab Laba Rugi (ProfitView / useSalesDaily), termasuk hasil audit admin.
    fetchAllPages<any>(() => supabase
      .from('sales_daily_scoped')
      .select('outlet_id, sales_source, sales_date, omzet, total_deductions, jumlah_order_completed')
      .in('outlet_id', targetOutletIds)
      .neq('outlet_id', TEST_OUTLET_ID)
      .gte('sales_date', filter.from)
      .lte('sales_date', filter.to)
      .order('sales_date', { ascending: true })
      .order('outlet_id', { ascending: true })
      .order('sales_source', { ascending: true })
    ).then(rows => ({ data: rows })).catch(err => {
      console.warn('Gagal memuat sales_daily_scoped di mitraPnl:', err)
      return { data: [] as any[] }
    }),
    // Mapping outlet binaan manajer (staff_outlets) untuk alokasi beban AM/RM
    supabase
      .from('staff_outlets')
      .select(`
        staff_id,
        outlet_id,
        outlet_staff!inner(id, role, is_active)
      `)
      .in('outlet_staff.role', ['area_manager', 'regional_manager'])
      .eq('outlet_staff.is_active', true),
    // Seluruh outlet operasional (internal & mitra) untuk dasar pembagian beban manajer
    supabase
      .from('outlets')
      .select('id, name, slug, type, is_active, status')
      .in('type', ['internal', 'mitra']),
    // HPP berbasis riwayat harga bahan baku & resep dinamis (Single Source of Truth)
    fetchHppRows(supabase, {
      from: filter.from,
      to: filter.to,
      outletId: selectedOutletId,
      source: 'all',
    }).catch(err => {
      console.warn('Gagal memuat fetchHppRows di mitraPnl:', err)
      return [] as HppRow[]
    }),
  ])

  const profile = profileRes.data
  const outletList = outletListRes.data
  const investments = investmentsRes.data
  const transfers = transfersRes.data
  let pettyExpenses = pettyExpensesRes.data || []
  let monthlyExpenses = monthlyExpensesRes.data || []
  let wasteRows = wasteRowsRes.data || []
  const { data: rpcData, error: rpcError } = rpcRes
  let settlements = (settlementsRes as any)?.data || []
  let salesDailyRows = (salesDailyRes as any)?.data || []
  const hppRows = Array.isArray(hppRowsRes) ? hppRowsRes : []

  // 3b. Cutoff Date Enforcement (Peralihan cabang internal ke kemitraan)
  // Transaksi pengeluaran & waste sebelum tanggal_mulai outlet tidak boleh dibebankan ke mitra.
  const outletCutoffMap = new Map<string, string>()
  for (const inv of investments || []) {
    if (inv?.outlet_id && inv?.tanggal_mulai) {
      outletCutoffMap.set(inv.outlet_id, inv.tanggal_mulai)
    }
  }

  if (outletCutoffMap.size > 0) {
    pettyExpenses = pettyExpenses.filter((p: any) => {
      const cutoff = outletCutoffMap.get(p.outlet_id)
      return !cutoff || p.expense_date >= cutoff
    })
    monthlyExpenses = monthlyExpenses.filter((m: any) => {
      const cutoff = outletCutoffMap.get(m.outlet_id)
      return !cutoff || m.expense_date >= cutoff
    })
    settlements = settlements.filter((s: any) => {
      const cutoff = outletCutoffMap.get(s.outlet_id)
      return !cutoff || s.tanggal >= cutoff
    })
    salesDailyRows = salesDailyRows.filter((s: any) => {
      const cutoff = outletCutoffMap.get(s.outlet_id)
      return !cutoff || s.sales_date >= cutoff
    })
    wasteRows = wasteRows.filter((w: any) => {
      const cutoff = outletCutoffMap.get(w.outlet_id)
      if (!cutoff) return true
      // Jika rentang filter berakhir sebelum cutoff, waste outlet ini adalah 0
      return filter.to >= cutoff
    })
  }

  // Penentuan persentase bagi hasil kini lewat resolveMitraPolicy() di bawah
  // (per-outlet, sadar BEP & cutoff September 2026). Blok lama yang menghitung
  // `profitSharingPct` di sini sudah tidak dibaca siapa pun sejak 407749ad.

  const outletName = selectedOutletId === 'all'
    ? (targetOutletIds.length > 1 ? `Semua Outlet (${targetOutletIds.length})` : (outletList?.[0]?.name || 'Semua Outlet'))
    : (outletList?.find(o => o.id === selectedOutletId)?.name || 'Outlet')

  // Fallback query builder (used ONLY if RPC fails)
  const buildOrdersQuery = () => supabase
    .from('orders')
    .select('id, outlet_id, created_at, discount_amount, promo_subsidy, channel, sales_source, is_endorse, total_amount, order_items(subtotal, quantity, menu_item_name, menu_items(id, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))))')
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

  const outletFinancialsMap = new Map<string, { gross: number; deductions: number; cogs: number }>()

  // 4a. Prioritaskan sales_daily_scoped untuk Omzet Kotor & Potongan
  // Diselaraskan 100% (Rp 0 selisih) dengan Tab Laba Rugi / useSalesDaily,
  // termasuk komisi platform (platform fee) dari platform_settlements dan audit promo merchant.
  const normalizePlatform = (src: string) => {
    const s = (src || '').toLowerCase()
    if (s.includes('gofood') || s.includes('gojek')) return 'gofood'
    if (s.includes('grab')) return 'grabfood'
    if (s.includes('shopee')) return 'shopeefood'
    if (s.includes('tiktok')) return 'tiktokgo'
    return s
  }

  const settlementCommissionMap = new Map<string, number>()
  const settlementPromoMap = new Map<string, number>()
  for (const s of (settlements || [])) {
    const plat = normalizePlatform(s.platform)
    const key = `${s.outlet_id}__${plat}__${s.tanggal}`
    settlementCommissionMap.set(key, (settlementCommissionMap.get(key) || 0) + (Number(s.commission) || 0))
    if (s.promo_merchant !== null && s.promo_merchant !== undefined) {
      settlementPromoMap.set(key, (settlementPromoMap.get(key) || 0) + Math.max(0, Number(s.promo_merchant) || 0))
    }
  }

  const hasSalesDaily = Array.isArray(salesDailyRows) && salesDailyRows.length > 0
  if (hasSalesDaily) {
    for (const row of salesDailyRows) {
      let totalDed = Number(row.total_deductions) || 0
      const plat = normalizePlatform(row.sales_source)
      const key = `${row.outlet_id}__${plat}__${row.sales_date}`
      const platformFee = settlementCommissionMap.get(key) || 0

      // Rekonsiliasi audit promo merchant dari settlement (GoFood & ShopeeFood):
      // Jika settlement resmi diupload, promo merchant dari settlement menjadi Single Source of Truth
      if (settlementPromoMap.has(key) && (plat === 'gofood' || plat === 'shopeefood')) {
        totalDed = settlementPromoMap.get(key) || 0
      }

      // Total potongan = promo merchant + komisi platform (platform fee)
      const rowDeductions = totalDed + platformFee
      const rawGross = (Number(row.omzet) || 0) + (Number(row.total_deductions) || 0)
      const gross = rawGross
      const count = Number(row.jumlah_order_completed) || 0
      const src = plat

      const curFin = outletFinancialsMap.get(row.outlet_id) || { gross: 0, deductions: 0, cogs: 0 }
      curFin.gross += gross
      curFin.deductions += rowDeductions
      outletFinancialsMap.set(row.outlet_id, curFin)

      if (src === 'tiktokgo' || src === 'tiktok') {
        tkGross += gross
        tkDeductions += rowDeductions
        tkCount += count
      } else if (src === 'grabfood') {
        faGross += gross
        faDeductions += rowDeductions
        faCount += count
        grabRev += gross
      } else if (src === 'gofood') {
        faGross += gross
        faDeductions += rowDeductions
        faCount += count
        gofoodRev += gross
      } else if (src === 'shopeefood') {
        faGross += gross
        faDeductions += rowDeductions
        faCount += count
        shopeeRev += gross
      } else {
        // 'pos', 'online', 'endors', dll.
        posGross += gross
        posDeductions += rowDeductions
        posCount += count
      }
    }
  }

  // 4b. HPP dari fetchHppRows (Single Source of Truth)
  if (hppRows.length > 0) {
    for (const r of hppRows) {
      if (!targetOutletIds.includes(r.outlet_id)) continue

      const outletHpp = Number(r.hpp) || 0
      const outletChannels = r.channels || { outlet: 0, food_apps: 0, tiktok_go: 0, website: 0 }

      posCogs += (Number(outletChannels.outlet) || 0) + (Number(outletChannels.website) || 0)
      faCogs += Number(outletChannels.food_apps) || 0
      tkCogs += Number(outletChannels.tiktok_go) || 0

      const curFin = outletFinancialsMap.get(r.outlet_id) || { gross: 0, deductions: 0, cogs: 0 }
      curFin.cogs += outletHpp
      outletFinancialsMap.set(r.outlet_id, curFin)
    }
  } else if (!rpcError && rpcData && Array.isArray(rpcData)) {
    // Fallback bila fetchHppRows tidak mengembalikan data: gunakan get_mitra_orders_summary
    for (const row of rpcData) {
      const gross = Number(row.gross_revenue) || 0
      const ded = Number(row.deductions) || 0
      const cogs = Number(row.cogs) || 0
      const count = Number(row.order_count) || 0

      const curFin = outletFinancialsMap.get(row.outlet_id) || { gross: 0, deductions: 0, cogs: 0 }
      curFin.cogs += cogs
      if (!hasSalesDaily) {
        curFin.gross += gross
        curFin.deductions += ded
      }
      outletFinancialsMap.set(row.outlet_id, curFin)

      if (row.channel_group === 'foodApps') {
        faCogs += cogs
        if (!hasSalesDaily) {
          faGross += gross
          faDeductions += ded
          faCount += count
          grabRev += Number(row.grab_rev) || 0
          gofoodRev += Number(row.gofood_rev) || 0
          shopeeRev += Number(row.shopee_rev) || 0
        }
      } else if (row.channel_group === 'tiktok') {
        tkCogs += cogs
        if (!hasSalesDaily) {
          tkGross += gross
          tkDeductions += ded
          tkCount += count
        }
      } else {
        posCogs += cogs
        if (!hasSalesDaily) {
          posGross += gross
          posDeductions += ded
          posCount += count
        }
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
        if (adalahKanalSsOnline(normCh)) { // hanya marketplace; ShopeeFood & TikTok GO pakai hpp_override
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

    const allOrdersRaw = await fetchAllPages<any>(buildOrdersQuery)
    const allOrders = allOrdersRaw.filter((o: any) => {
      const cutoff = outletCutoffMap.get(o.outlet_id)
      return !cutoff || o.created_at >= `${cutoff}T00:00:00+07:00`
    })

    // Cadangan HPP lewat NAMA menu: jalur pemesanan web menyimpan order_items
    // tanpa `menu_item_id`, sehingga lookup lewat id menghasilkan 0 dan biaya
    // bahannya hilang dari laba mitra. Pola sama dengan useHpp.ts di dashboard
    // Owner. Dipakai HANYA saat lookup id gagal.
    const { data: menuList } = await supabase
      .from('menu_items')
      .select('id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))')
    const menuByName = new Map<string, any>()
    for (const m of menuList ?? []) {
      if (m?.name) menuByName.set(cleanItemName(m.name).trim().toLowerCase(), m)
    }
    const penerapHpp = buatPenerapRiwayat(menuList ?? [], await ambilRiwayatHpp(supabase), (n: string) => n)
    const hppByName = (rawName?: string | null, channel?: string | null, tgl?: string): number => {
      if (!rawName) return 0
      const m = menuByName.get(cleanItemName(rawName).trim().toLowerCase())
      return m ? getItemHpp(tgl ? penerapHpp.untuk(tgl).terapkan(m) : m, 'mitra', channel) : 0
    }

    for (const ord of allOrders) {
      const totalAmt = Number(ord.total_amount) || 0
      const disc = Number(ord.discount_amount) || 0
      const promo = Number(ord.promo_subsidy) || 0
      const ch = (ord.channel || 'pos').toLowerCase()
      const src = (ord.sales_source || ch).toLowerCase()

      let orderCogs = 0
      const tglOrder = tanggalWib(ord.created_at)

      if (Array.isArray(ord.order_items)) {
        for (const item of ord.order_items) {
          const qty = Number(item.quantity) || 1
          const hpp = getItemHpp(penerapHpp.untuk(tglOrder).terapkan(item.menu_items), 'mitra', ord.channel)
            || hppByName(item.menu_item_name, ord.channel, tglOrder)
          orderCogs += (hpp * qty)
        }
      }

      const isTk =
        src.includes('tiktok') ||
        ch.includes('tiktok') ||
        ch === 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8' ||
        ch === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5'

      const isFa =
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

      // ACUAN TUNGGAL Omzet Kotor (migration 20300128000000 & 20300250000000):
      // - POS: total_amount adalah net. Omzet = total_amount + potongan.
      // - Food Apps/TikTok: total_amount sudah gross. Potongan = MAX(0, itemValue - totalAmt) + promo.
      //   Omzet = MAX(itemValue, totalAmt).
      const itemValue = (ord.order_items || []).reduce(
        (s: number, i: any) => s + (Number(i.subtotal) || 0),
        0
      )
      let grossRev: number
      let deductions: number

      if (isTk || isFa) {
        grossRev = (ord.order_items || []).length > 0 ? Math.max(itemValue, totalAmt) : totalAmt
        deductions = Math.max(0, itemValue - totalAmt) + promo
      } else {
        deductions = (ord.order_items || []).length > 0
          ? Math.max(0, itemValue - totalAmt)
          : disc + promo
        grossRev = totalAmt + deductions
      }

      const curFin = outletFinancialsMap.get(ord.outlet_id) || { gross: 0, deductions: 0, cogs: 0 }
      if (!hasSalesDaily) {
        curFin.gross += grossRev
        curFin.deductions += deductions
      }
      curFin.cogs += orderCogs
      outletFinancialsMap.set(ord.outlet_id, curFin)

      if (isTk) {
        if (!hasSalesDaily) {
          tkGross += grossRev
          tkDeductions += deductions
          tkCount++
        }
        tkCogs += orderCogs
      } else if (isFa) {
        if (!hasSalesDaily) {
          faGross += grossRev
          faDeductions += deductions
          faCount++
          if (src.includes('grab') || ch.includes('grab') || ch === '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a') grabRev += totalAmt
          else if (src.includes('gofood') || src.includes('go_food') || src.includes('gojek') || ch.includes('gofood') || ch.includes('go_food') || ch.includes('gojek') || ch === '1284ac2a-e753-4380-9f32-59219a322459') gofoodRev += totalAmt
          else if (src.includes('shopee') || ch.includes('shopee') || ch === '0eaf2746-da9f-492c-a9b4-f091307c98c2') shopeeRev += totalAmt
        }
        faCogs += orderCogs
      } else {
        // Default to POS (Dine-in, Takeaway, QRIS, Kasir)
        if (!hasSalesDaily) {
          posGross += grossRev
          posDeductions += deductions
          posCount++
        }
        posCogs += orderCogs
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

  // Sinkronisasi OPEX dengan Tab Laba Rugi via calculateProratedExpenses
  const ALLOWED_ROLES = ['crew', 'leader', 'kasir', 'kitchen', 'driver', 'area_manager', 'regional_manager']
  const payrollRows = (payrollRes?.data ?? [])
    .filter((r: any) => {
      const s = r.outlet_staff
      if (!s) return false
      if (isTestOrDevStaff(s)) return false
      if (!ALLOWED_ROLES.includes(s.role)) return false
      const isManager = s.role === 'area_manager' || s.role === 'regional_manager'
      const effectiveOutletId = (r.outlet_id || s.outlet_id) as string
      if (!isManager) {
        if (!effectiveOutletId || effectiveOutletId === KANTOR_PUSAT_ID) return false
        if (!targetOutletIds.includes(effectiveOutletId)) return false
      }
      return true
    })
    .map((r: any) => ({
      staff_id: (r.outlet_staff?.id || r.staff_id) as string,
      outlet_id: (r.outlet_id || r.outlet_staff?.outlet_id) as string,
      total_salary: Number(r.total_salary) || 0,
      bonus: Number(r.bonus) || 0,
      period_month: Number(r.period_month),
      period_year: Number(r.period_year),
      role: r.outlet_staff.role
    }))

  const staffRows = (staffRes?.data ?? [])
    .filter((s: any) => !isTestOrDevStaff(s) && s.outlet_id && s.outlet_id !== KANTOR_PUSAT_ID && targetOutletIds.includes(s.outlet_id))
    .map((s: any) => {
      const fin = Array.isArray(s.staff_financials) ? s.staff_financials[0] : s.staff_financials
      return {
        outlet_id: s.outlet_id,
        basic_salary: Number(fin?.basic_salary) || 0,
        allowance_position: Number(fin?.allowance_position) || 0,
        allowance_presence: Number(fin?.allowance_presence) || 0,
        role: s.role
      }
    })

  const managerMap = new Map<string, ManagerAssignment>()
  for (const row of ((managerStaffRes?.data ?? []) as any[])) {
    const sid = row.staff_id
    const role = (row.outlet_staff as any)?.role || 'area_manager'
    if (!managerMap.has(sid)) {
      managerMap.set(sid, { staff_id: sid, role, outlet_ids: [] })
    }
    managerMap.get(sid)!.outlet_ids.push(row.outlet_id)
  }
  const managerAssignments = Array.from(managerMap.values())

  const bonusOutletIds = new Set(((bonusRes as any) || []).map((c: any) => c.outlet_id))
  const operationalOutlets = ((allOpOutletsRes?.data ?? []) as any[])
    .filter(o => {
      if (isExcludedOutlet(o)) return false
      // Sawangan internal digantikan oleh Mitra Sawangan DTC agar tidak double-counting
      if (o.slug === 'sawangan-depok-internal') return false
      const isActive = o.is_active === true && o.status === 'active'
      const hadActivityInPeriod = bonusOutletIds.has(o.id)
      return isActive || hadActivityInPeriod
    })
  const operationalOutletIds: string[] = operationalOutlets.map(o => o.id)

  const outletNameMap = new Map((operationalOutlets || []).map((o: any) => [o.id, o.name]))
  for (const o of (outletList || [])) {
    outletNameMap.set(o.id, o.name)
  }

  const rawMonthlyExpenses = (monthlyExpenses || []).map((e: any) => ({
    id: e.id,
    outlet_id: e.outlet_id,
    outlet_name: outletNameMap.get(e.outlet_id) || 'Outlet',
    amount: Number(e.amount) || 0,
    category: e.category,
    description: e.description ?? '',
    expense_date: e.expense_date,
    period_month: (e.expense_date || '').slice(0, 7) + '-01',
    scope: 'outlet' as const,
    source: 'monthly' as const
  }))

  const simpanKasKecil = buatSaringanKasKecil(rawMonthlyExpenses)
  const rawPettyExpenses = (pettyExpenses || [])
    .filter(simpanKasKecil)
    .map((p: any) => ({
      id: p.id,
      outlet_id: p.outlet_id,
      outlet_name: outletNameMap.get(p.outlet_id) || 'Outlet',
      amount: Number(p.amount) || 0,
      category: p.category,
      description: p.description ?? '',
      expense_date: p.expense_date,
      period_month: (p.expense_date || '').slice(0, 7) + '-01',
      scope: 'outlet' as const,
      source: 'petty_cash' as const
    }))

  const rawExpenses = [...rawMonthlyExpenses, ...rawPettyExpenses]

  const prorataResult = calculateProratedExpenses({
    filter: { from: filter.from, to: filter.to, outletId: 'all', source: 'all' },
    rawExpenses,
    payrollRecords: payrollRows,
    staffFinancials: staffRows,
    lastMonthExpenses: (lastMonthExpRes?.data as any) || [],
    crewBonusRecords: (bonusRes as any) || [],
    outlets: operationalOutlets.map(o => ({ id: o.id, name: o.name, is_active: o.is_active })),
    managerAssignments,
    operationalOutletIds,
  })

  const outletOpexMap = new Map<string, number>()
  let totalPettyCash = 0
  let totalMonthly = 0

  for (const r of prorataResult.rows) {
    if (!r.outlet_id || !targetOutletIds.includes(r.outlet_id)) continue

    const cutoff = outletCutoffMap.get(r.outlet_id)
    if (cutoff && r.expense_date < cutoff) continue

    const amt = Number(r.amount) || 0
    if (r.source === 'petty_cash') {
      totalPettyCash += amt
    } else {
      totalMonthly += amt
    }

    outletOpexMap.set(r.outlet_id, (outletOpexMap.get(r.outlet_id) || 0) + amt)

    const cat = mapToStandardCategory(r.category, r.description)
    const existing = categoryMap.get(cat) || { amount: 0, items: [] }
    existing.amount += amt
    existing.items.push({
      description: r.description || r.category || 'Biaya Operasional',
      amount: amt,
      date: r.expense_date,
      source: r.source === 'petty_cash' ? 'petty_cash' : 'monthly'
    })
    categoryMap.set(cat, existing)
  }

  const opexCategories: OpexCategoryDetail[] = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      items: data.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }))
    .sort((a, b) => b.amount - a.amount)

  let grandTotalOpex = totalPettyCash + totalMonthly

  // 7. Waste
  const outletWasteMap = new Map<string, number>()
  let totalWaste = 0
  if (wasteRows) {
    for (const w of wasteRows) {
      if (!targetOutletIds.includes(w.outlet_id)) continue
      const amt = Number(w.nilai_waste) || 0
      totalWaste += amt
      if (w.outlet_id) {
        outletWasteMap.set(w.outlet_id, (outletWasteMap.get(w.outlet_id) || 0) + amt)
      }
    }
  }

  // 7b. Audited Monthly Closing Data (Agustus 2026)
  if (isAugust2026Period(filter.from, filter.to)) {
    let hasClosing = false
    for (const oid of targetOutletIds) {
      if (getMitraAugustClosing(oid)) {
        hasClosing = true
        break
      }
    }

    if (hasClosing) {
      posGross = 0
      posDeductions = 0
      posCogs = 0
      faGross = 0
      faDeductions = 0
      faCogs = 0
      tkGross = 0
      tkDeductions = 0
      tkCogs = 0

      for (const oid of targetOutletIds) {
        const closing = getMitraAugustClosing(oid)
        if (closing) {
          outletFinancialsMap.set(oid, {
            gross: closing.totals.grossRevenue,
            deductions: closing.totals.totalDeductions,
            cogs: closing.totals.totalCogs
          })
          outletWasteMap.set(oid, closing.totals.totalWaste)
          outletOpexMap.set(oid, closing.totals.totalOpex)

          posGross += closing.pos.revenue
          posDeductions += closing.pos.deductions
          posCogs += closing.pos.cogs

          faGross += closing.foodApps.revenue
          faDeductions += closing.foodApps.deductions
          faCogs += closing.foodApps.cogs

          tkGross += closing.tiktok.revenue
          tkDeductions += closing.tiktok.deductions
          tkCogs += closing.tiktok.cogs
        }
      }

      totalWaste = targetOutletIds.reduce((sum, oid) => sum + (outletWasteMap.get(oid) || 0), 0)
      grandTotalOpex = targetOutletIds.reduce((sum, oid) => sum + (outletOpexMap.get(oid) || 0), 0)
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
  let singleSharingActive = true

  for (const oid of targetOutletIds) {
    const inv = invMap.get(oid)
    const outletTransfers = (transfers || []).filter(t => t.outlet_id === oid)
    const invWithTransfers = { ...inv, transfers: outletTransfers }
    const bepInfo = calculateMitraBepStatus(invWithTransfers, oid, filter.from, inv?.isBep)
    const isOutletBep = bepInfo.isBep

    const legacyShare = Number(inv?.persentase_bagi_hasil) || Number(profile?.profit_sharing_pct) || 50
    const legacyFee = Number(inv?.management_fee) || 0

    // `is_profit_sharing_active` sebelumnya HANYA ditulis panel owner, tak pernah
    // dibaca perhitungan mana pun: outlet yang bagi hasilnya sengaja dimatikan
    // tetap menampilkan jatah mitra. Baris NULL/undefined (belum pernah diisi)
    // diperlakukan aktif supaya outlet lama tak ikut mati mendadak — hanya
    // `false` eksplisit yang mematikan.
    const sharingActive = inv?.is_profit_sharing_active !== false

    const policy = resolveMitraPolicy({
      periodFrom: filter.from,
      isBep: isOutletBep,
      legacyProfitSharingPct: legacyShare,
      legacyManagementFee: legacyFee
    })

    const fin = outletFinancialsMap.get(oid) || { gross: 0, deductions: 0, cogs: 0 }
    const opex = outletOpexMap.get(oid) || 0
    const waste = outletWasteMap.get(oid) || 0

    const closing = isAugust2026Period(filter.from, filter.to) ? getMitraAugustClosing(oid) : undefined
    let mgmtFee = 0
    if (closing) {
      mgmtFee = Math.round(closing.totals.managementFeeAmount)
    } else if (policy.managementFeePct > 0) {
      mgmtFee = Math.round((fin.gross * policy.managementFeePct) / 100)
    }

    let outletNetProfit = fin.gross - fin.deductions - fin.cogs - opex - waste - mgmtFee
    let outletMitraShare = sharingActive && outletNetProfit > 0
      ? Math.round((outletNetProfit * policy.profitSharingPct) / 100)
      : 0

    if (closing) {
      outletNetProfit = Math.round(closing.totals.netProfit)
      outletMitraShare = Math.round(closing.totals.mitraShare)
    }

    totalManagementFeeAmount += mgmtFee
    totalMitraShare += outletMitraShare

    if (targetOutletIds.length === 1) {
      singlePolicyStatus = sharingActive ? policy.statusLabel : 'Bagi Hasil Nonaktif'
      singleIsBep = policy.isBep
      singleManagementFeePct = policy.managementFeePct
      singleProfitSharingPct = sharingActive ? policy.profitSharingPct : 0
      singleSharingActive = sharingActive
    }
  }

  const managementFeeAmount = Math.round(totalManagementFeeAmount)
  let netProfit = grossProfit - grandTotalOpex - totalWaste - managementFeeAmount
  let mitraShare = totalMitraShare

  if (isAugust2026Period(filter.from, filter.to)) {
    let closingNet = 0
    let closingMitra = 0
    let matchCount = 0
    for (const oid of targetOutletIds) {
      const c = getMitraAugustClosing(oid)
      if (c) {
        closingNet += c.totals.netProfit
        closingMitra += c.totals.mitraShare
        matchCount++
      }
    }
    if (matchCount === targetOutletIds.length) {
      netProfit = Math.round(closingNet)
      mitraShare = Math.round(closingMitra)
    }
  }

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

  // Definisi bersama dengan mitraRoi.ts: "dana kembali yang sudah beres" =
  // bagi hasil historis (di luar sistem) + transfer yang tercatat di sistem.
  // Akrual periode berjalan (sudah dihasilkan, belum ditransfer) SENGAJA tidak
  // masuk ke sini; itu ditambahkan terpisah di kartu ROI (mitraRoi.ts) supaya
  // "sudah kembali" dan "sedang berjalan" tak tercampur jadi satu angka.
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

  const finalSharingActive = targetOutletIds.length === 1 ? singleSharingActive : true

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
      isBep: finalIsBep,
      profitSharingActive: finalSharingActive
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
