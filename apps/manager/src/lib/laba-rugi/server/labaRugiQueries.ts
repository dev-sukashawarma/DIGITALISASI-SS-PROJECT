import type { SupabaseClient } from '@supabase/supabase-js'
import type { Outlet, PeriodFilterValue, SalesSource, SalesSummaryRow } from '../types'
import { isTestOutlet, TEST_OUTLET_ID } from '../outletFilters'
import { fetchAllPages } from '../fetchAllPages'
import { fetchAllPagesParallel } from '../queryPaging'
import {
  normalizeSettlementPlatform,
  reconcileRowPromoWithSettlement,
  splitDateRangeChunks,
} from '../ownerDashboardAlign'
import { getMitraAugustClosing } from '../closing/mitraPnlClosingData'

export interface WasteRow {
  outlet_id: string
  nilai_waste: number
}

export interface MitraTransferRecord {
  id: string
  outlet_id: string
  bulan: string | null
  nominal: number
}

export interface MitraInvestmentExtended {
  id: string
  outlet_id: string
  nilai_investasi: number
  tanggal_mulai: string | null
  catatan: string | null
  created_at: string
  updated_at: string
  omzet_historis: number
  transfer_historis: number
  is_profit_sharing_active: boolean
  persentase_bagi_hasil: number
  management_fee: number
  totalTransfers: number
  totalDanaKembali: number
  isBep: boolean
  transfers?: MitraTransferRecord[]
}

export interface TikTokSettlementSummary {
  outletId: string
  omzetKotor: number
  promoMerchant: number
  commission: number
  totalSettlement: number
}

export interface PlatformSettlementAggregate {
  promoMerchant: number
  commission: number
  omzetKotor: number
}

export interface AllPlatformSettlementsResult {
  tiktokSummaries: Record<string, TikTokSettlementSummary>
  byOutletPlatform: Record<string, PlatformSettlementAggregate>
}

export async function fetchOutletsCore(supabase: SupabaseClient): Promise<Outlet[]> {
  const { data, error } = await supabase
    .from('outlets')
    .select('id, name, slug, type, region, is_active, status, nonaktif_at')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as Outlet[]).filter((o) => !isTestOutlet(o))
}

export async function fetchSalesDailyCore(
  supabase: SupabaseClient,
  filter: PeriodFilterValue,
): Promise<SalesSummaryRow[]> {
  const PAGE_SIZE = 1000
  const buildSalesQuery = (chunkFrom: string, chunkTo: string) => {
    let b = supabase
      .from('sales_daily_scoped')
      .select('outlet_id, sales_source, sales_date, omzet, total_deductions, jumlah_order_completed')
      .neq('outlet_id', TEST_OUTLET_ID)
      .gte('sales_date', chunkFrom)
      .lte('sales_date', chunkTo)
      .order('sales_date', { ascending: true })
      .order('outlet_id', { ascending: true })
      .order('sales_source', { ascending: true })

    if (filter.outletId !== 'all') b = b.eq('outlet_id', filter.outletId)
    if (filter.source !== 'all') b = b.eq('sales_source', filter.source)
    return b
  }

  const salesData: any[] = []
  for (const chunk of splitDateRangeChunks(filter.from, filter.to, 10)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await buildSalesQuery(chunk.from, chunk.to).range(offset, offset + PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      const page = data ?? []
      salesData.push(...page)
      if (page.length < PAGE_SIZE) break
    }
  }

  let settlementList: any[] = []
  try {
    settlementList = await fetchAllPagesParallel<any>(
      (from, to, withCount) => {
        let b = supabase
          .from('platform_settlements')
          .select('outlet_id, platform, tanggal, commission, promo_merchant', withCount ? { count: 'exact' } : undefined)
          .gte('tanggal', filter.from)
          .lte('tanggal', filter.to)
          .order('tanggal', { ascending: true })
          .order('id', { ascending: true })
        if (filter.outletId !== 'all') {
          b = b.eq('outlet_id', filter.outletId)
        }
        return b.range(from, to)
      },
      1000,
    )
  } catch (settlementError) {
    console.error('fetchSalesDailyCore platform_settlements error:', settlementError)
  }

  const settlementCommissionMap = new Map<string, number>()
  const settlementPromoMap = new Map<string, number>()
  for (const s of settlementList) {
    const plat = normalizeSettlementPlatform(s.platform)
    const key = `${s.outlet_id}__${plat}__${s.tanggal}`
    settlementCommissionMap.set(key, (settlementCommissionMap.get(key) || 0) + (Number(s.commission) || 0))
    if (s.promo_merchant !== null && s.promo_merchant !== undefined) {
      settlementPromoMap.set(key, (settlementPromoMap.get(key) || 0) + Math.max(0, Number(s.promo_merchant) || 0))
    }
  }

  const posRows: SalesSummaryRow[] = salesData
    .filter((r: any) => !isTestOutlet(r.outlet_id))
    .map((r: any) => {
      const plat = normalizeSettlementPlatform(r.sales_source)
      const key = `${r.outlet_id}__${plat}__${r.sales_date}`
      const platformFee = settlementCommissionMap.get(key) || 0
      const reconciled = reconcileRowPromoWithSettlement(
        plat,
        key,
        Number(r.omzet) || 0,
        Number(r.total_deductions) || 0,
        settlementPromoMap,
      )

      return {
        outlet_id: r.outlet_id,
        outlet_name: '',
        sales_source: r.sales_source as SalesSource,
        sales_date: r.sales_date,
        omzet: reconciled.omzet,
        jumlah_order_completed: Number(r.jumlah_order_completed || 0),
        jumlah_order_all: Number(r.jumlah_order_completed || 0),
        total_deductions: reconciled.total_deductions,
        platform_fee: platformFee,
      }
    })

  const fromIso = new Date(`${filter.from}T00:00:00+07:00`).toISOString()
  const toIso = new Date(`${filter.to}T23:59:59.999+07:00`).toISOString()

  const allEcommerceRows: SalesSummaryRow[] = []
  if (filter.outletId === 'all' || filter.outletId === 'ss-online') {
    let ecommerceSalesList: any[] = []
    try {
      ecommerceSalesList = await fetchAllPagesParallel<any>(
        (from, to, withCount) =>
          supabase
            .from('ecommerce_sales')
            .select(
              'id, channel_id, order_date, total_amount, raw_data',
              withCount ? { count: 'exact' } : undefined,
            )
            .gte('order_date', fromIso)
            .lte('order_date', toIso)
            .order('order_date', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        1000,
      )
    } catch (ecommerceError) {
      console.error('fetchSalesDailyCore ecommerce error:', ecommerceError)
    }

    const ecommerceSummaryMap = new Map<string, SalesSummaryRow>()
    for (const saleRecord of ecommerceSalesList) {
      const raw = saleRecord.raw_data || {}
      const totalPotongan = Math.abs(Number(raw.total_potongan || raw.admin_fee || raw.discount_amount) || 0)
      const omzetKotor = Number(saleRecord.total_amount) || 0
      const omzetNet = Math.max(0, omzetKotor - totalPotongan)

      const d = new Date(saleRecord.order_date)
      const dateStr = new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0]

      const chNorm = (saleRecord.channel_id || '').toLowerCase()
      let salesSource: SalesSource = 'online'
      if (chNorm.includes('tiktok') || chNorm === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5') {
        salesSource = 'tiktok_shop' as SalesSource
      } else if (chNorm.includes('shopee') || chNorm === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584') {
        salesSource = 'shopee_shop' as SalesSource
      }

      if (filter.source !== 'all') {
        const sf = filter.source.toLowerCase()
        if (sf === 'pos') continue
        if (sf.includes('tiktok') && salesSource !== 'tiktok_shop') continue
        if (sf.includes('shopee') && salesSource !== 'shopee_shop') continue
        if (sf === 'online' && salesSource !== 'online') continue
      }

      const key = `ss-online__${salesSource}__${dateStr}`
      const existing = ecommerceSummaryMap.get(key) || {
        outlet_id: 'ss-online',
        outlet_name: 'SS ONLINE',
        sales_source: salesSource,
        sales_date: dateStr,
        omzet: 0,
        jumlah_order_completed: 0,
        jumlah_order_all: 0,
        total_deductions: 0,
        platform_fee: 0,
      }
      existing.omzet += omzetNet
      existing.jumlah_order_completed += 1
      existing.jumlah_order_all += 1
      existing.total_deductions = (existing.total_deductions || 0) + totalPotongan
      ecommerceSummaryMap.set(key, existing)
    }

    allEcommerceRows.push(...Array.from(ecommerceSummaryMap.values()))
  }

  return [...posRows, ...allEcommerceRows]
}

export async function fetchWasteCore(
  supabase: SupabaseClient,
  filter: { from: string; to: string; outletId?: string },
): Promise<WasteRow[]> {
  const { data, error } = await supabase.rpc('get_waste_periode', {
    p_from: filter.from,
    p_to: filter.to,
  })
  if (error) throw new Error(error.message)
  let rows: WasteRow[] = (data ?? [])
    .filter((r: any) => r.outlet_id !== TEST_OUTLET_ID && !isTestOutlet(r.outlet_id))
    .map((r: any) => ({
      outlet_id: r.outlet_id as string,
      nilai_waste: Number(r.nilai_waste),
    }))
  if (filter.outletId && filter.outletId !== 'all') {
    rows = rows.filter((r) => r.outlet_id === filter.outletId)
  }
  return rows
}

export async function fetchPendapatanLainCore(
  supabase: SupabaseClient,
  filter: { from: string; to: string },
): Promise<number> {
  let total = 0
  const PAGE = 1000
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase
      .from('income_lainnya')
      .select('id, amount')
      .eq('status', 'aktif')
      .gte('occurred_at', `${filter.from}T00:00:00+07:00`)
      .lte('occurred_at', `${filter.to}T23:59:59.999+07:00`)
      .order('id')
      .range(start, start + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    total += rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    if (rows.length < PAGE) break
  }
  return total
}

export async function fetchMitraInvestmentsCore(
  supabase: SupabaseClient,
): Promise<Record<string, MitraInvestmentExtended>> {
  const [invRes, transfers] = await Promise.all([
    supabase.from('mitra_investments').select('*'),
    fetchAllPages<MitraTransferRecord>(() =>
      supabase.from('mitra_transfers').select('id, outlet_id, bulan, nominal').order('id', { ascending: true })
    ),
  ])

  if (invRes.error) throw new Error(invRes.error.message)

  const transfersByOutlet = new Map<string, MitraTransferRecord[]>()
  for (const t of transfers ?? []) {
    if (!t.outlet_id) continue
    const list = transfersByOutlet.get(t.outlet_id) || []
    list.push(t)
    transfersByOutlet.set(t.outlet_id, list)
  }

  const map: Record<string, MitraInvestmentExtended> = {}
  for (const inv of invRes.data ?? []) {
    const outletTransfersList = transfersByOutlet.get(inv.outlet_id) ?? []
    let outletTransfers = outletTransfersList.reduce((sum, t) => sum + (Number(t.nominal) || 0), 0)

    const hasAugTransfer = outletTransfersList.some((t: any) => (t.bulan || '').slice(0, 7) === '2026-08')
    if (!hasAugTransfer) {
      const augClosing = getMitraAugustClosing(inv.outlet_id)
      if (augClosing && augClosing.totals.mitraShare > 0) {
        outletTransfers += Math.round(augClosing.totals.mitraShare)
      }
    }

    const totalDanaKembali = Number(inv.omzet_historis || 0) + Number(inv.transfer_historis || 0) + outletTransfers
    const modalInvestasi = Number(inv.nilai_investasi) || 0
    const isBep = modalInvestasi > 0 && totalDanaKembali >= modalInvestasi

    map[inv.outlet_id] = {
      ...inv,
      totalTransfers: outletTransfers,
      totalDanaKembali,
      isBep,
      transfers: outletTransfersList,
    }
  }

  return map
}

export async function fetchAllPlatformSettlementsCore(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<{ success: boolean; data?: AllPlatformSettlementsResult; error?: string }> {
  try {
    const PAGE_SIZE = 1000
    const allRows: any[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('platform_settlements')
        .select('outlet_id, platform, omzet_kotor, promo_merchant, commission')
        .gte('tanggal', from)
        .lte('tanggal', to)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw error
      const page = data ?? []
      allRows.push(...page)
      if (page.length < PAGE_SIZE) break
    }

    const tiktokSummaries: Record<string, TikTokSettlementSummary> = {}
    const byOutletPlatform: Record<string, PlatformSettlementAggregate> = {}

    for (const row of allRows) {
      const oId = row.outlet_id
      if (!oId) continue
      const plat = (row.platform || '').toLowerCase()
      const omzet = Number(row.omzet_kotor) || 0
      const promo = Number(row.promo_merchant) || 0
      const comm = Number(row.commission) || 0

      const key = `${oId}|${plat}`
      if (!byOutletPlatform[key]) {
        byOutletPlatform[key] = { promoMerchant: 0, commission: 0, omzetKotor: 0 }
      }
      byOutletPlatform[key].omzetKotor += omzet
      byOutletPlatform[key].promoMerchant += promo
      byOutletPlatform[key].commission += comm

      if (plat === 'tiktokgo' || plat === 'tiktok' || plat === 'tiktok_go') {
        if (!tiktokSummaries[oId]) {
          tiktokSummaries[oId] = {
            outletId: oId,
            omzetKotor: 0,
            promoMerchant: 0,
            commission: 0,
            totalSettlement: 0,
          }
        }
        tiktokSummaries[oId].omzetKotor += omzet
        tiktokSummaries[oId].promoMerchant += promo
        tiktokSummaries[oId].commission += comm
        tiktokSummaries[oId].totalSettlement += omzet - promo - comm
      }
    }

    return {
      success: true,
      data: {
        tiktokSummaries,
        byOutletPlatform,
      },
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal memuat ringkasan settlement platform' }
  }
}
