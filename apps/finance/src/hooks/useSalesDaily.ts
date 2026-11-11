'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

export interface SalesSummaryRow {
  outlet_id: string
  outlet_name: string
  sales_source: string
  sales_date: string
  omzet: number
  jumlah_order_completed: number
  jumlah_order_all: number
  total_deductions: number
  platform_fee: number
}

function splitDateRangeChunks(
  from: string,
  to: string,
  maxDays = 10,
): { from: string; to: string }[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return [{ from, to }]
  }
  const DAY_MS = 86_400_000
  const startMs = Date.parse(`${from}T00:00:00Z`)
  const endMs = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return [{ from, to }]
  }
  const stepDays = Math.max(1, Math.floor(maxDays))
  const chunks: { from: string; to: string }[] = []
  for (let cur = startMs; cur <= endMs; ) {
    const chunkEnd = Math.min(endMs, cur + (stepDays - 1) * DAY_MS)
    chunks.push({
      from: new Date(cur).toISOString().slice(0, 10),
      to: new Date(chunkEnd).toISOString().slice(0, 10),
    })
    cur = chunkEnd + DAY_MS
  }
  return chunks
}

function normalizePlatform(src: string | null | undefined): string {
  const s = (src || '').toLowerCase()
  if (s.includes('gofood') || s.includes('gojek')) return 'gofood'
  if (s.includes('grab')) return 'grabfood'
  if (s.includes('shopee')) return 'shopeefood'
  if (s.includes('tiktok')) return 'tiktokgo'
  return s
}

export function useSalesDaily(
  filter: { from: string; to: string; outletId: string; source: string },
  outlets?: { id: string; name: string }[],
  options?: { enabled?: boolean }
) {
  const supabase = createSupabaseBrowserClient()
  const query = useQuery<SalesSummaryRow[]>({
    queryKey: ['sales-daily', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 2 * 60_000,
    enabled: (options?.enabled ?? true) && Boolean(filter.from && filter.to),
    queryFn: async () => {
      const PAGE_SIZE = 1000
      const salesData: any[] = []

      // Paginasi berurutan per potongan <= 10 hari agar tidak terpotong di 1.000 baris PostgREST
      // dan tidak pernah menyentuh statement_timeout 8 detik pada rentang 1 bulan penuh.
      for (const chunk of splitDateRangeChunks(filter.from, filter.to, 10)) {
        for (let offset = 0; ; offset += PAGE_SIZE) {
          let q = supabase
            .from('sales_daily_scoped')
            .select('outlet_id, sales_source, sales_date, omzet, total_deductions, jumlah_order_completed')
            .neq('outlet_id', TEST_OUTLET_ID)
            .gte('sales_date', chunk.from)
            .lte('sales_date', chunk.to)
            .order('sales_date', { ascending: true })
            .order('outlet_id', { ascending: true })
            .order('sales_source', { ascending: true })

          if (filter.outletId !== 'all') {
            q = q.eq('outlet_id', filter.outletId)
          }
          if (filter.source !== 'all') {
            q = q.eq('sales_source', filter.source)
          }

          const { data, error } = await q.range(offset, offset + PAGE_SIZE - 1)
          if (error) throw error
          const page = data ?? []
          salesData.push(...page)
          if (page.length < PAGE_SIZE) break
        }
      }

      const settlementCommissionMap = new Map<string, number>()
      const settlementPromoMap = new Map<string, number>()
      try {
        let offset = 0
        while (true) {
          let b = supabase
            .from('platform_settlements')
            .select('outlet_id, platform, tanggal, commission, promo_merchant')
            .gte('tanggal', filter.from)
            .lte('tanggal', filter.to)
            .order('tanggal', { ascending: true })
            .order('id', { ascending: true })
          if (filter.outletId !== 'all') {
            b = b.eq('outlet_id', filter.outletId)
          }
          const { data: stlPage, error: stlErr } = await b.range(offset, offset + 999)
          if (stlErr) throw stlErr
          const page = stlPage ?? []
          for (const s of page) {
            const plat = normalizePlatform(s.platform)
            const key = `${s.outlet_id}__${plat}__${s.tanggal}`
            settlementCommissionMap.set(key, (settlementCommissionMap.get(key) || 0) + (Number(s.commission) || 0))
            if (s.promo_merchant !== null && s.promo_merchant !== undefined) {
              settlementPromoMap.set(key, (settlementPromoMap.get(key) || 0) + Math.max(0, Number(s.promo_merchant) || 0))
            }
          }
          if (page.length < 1000) break
          offset += 1000
        }
      } catch (err) {
        console.error('Error fetching settlements in useSalesDaily:', err)
      }

      const posRows: SalesSummaryRow[] = salesData
        .filter((r: any) => !isTestOutlet(r.outlet_id))
        .map((r: any) => {
          const safeOmzet = Number(r.omzet || 0)
          const safeDed = Number(r.total_deductions) || 0
          const plat = normalizePlatform(r.sales_source)
          const key = `${r.outlet_id}__${plat}__${r.sales_date}`
          const platformFee = settlementCommissionMap.get(key) || 0

          if (plat === 'tiktokgo') {
            const settlementPromo = settlementPromoMap.has(key) ? (settlementPromoMap.get(key) || 0) : 0
            const rawGross = safeOmzet + safeDed
            return {
              outlet_id: r.outlet_id,
              outlet_name: '',
              sales_source: r.sales_source,
              sales_date: r.sales_date,
              omzet: Math.max(0, rawGross - settlementPromo),
              jumlah_order_completed: Number(r.jumlah_order_completed || 0),
              jumlah_order_all: Number(r.jumlah_order_completed || 0),
              total_deductions: settlementPromo,
              platform_fee: platformFee,
            }
          }

          if (
            settlementPromoMap.has(key) &&
            (plat === 'gofood' || plat === 'shopeefood' || plat === 'grabfood')
          ) {
            const settlementPromo = settlementPromoMap.get(key) || 0
            const rawGross = safeOmzet + safeDed
            return {
              outlet_id: r.outlet_id,
              outlet_name: '',
              sales_source: r.sales_source,
              sales_date: r.sales_date,
              omzet: Math.max(0, rawGross - settlementPromo),
              jumlah_order_completed: Number(r.jumlah_order_completed || 0),
              jumlah_order_all: Number(r.jumlah_order_completed || 0),
              total_deductions: settlementPromo,
              platform_fee: platformFee,
            }
          }

          return {
            outlet_id: r.outlet_id,
            outlet_name: '',
            sales_source: r.sales_source,
            sales_date: r.sales_date,
            omzet: safeOmzet,
            jumlah_order_completed: Number(r.jumlah_order_completed || 0),
            jumlah_order_all: Number(r.jumlah_order_completed || 0),
            total_deductions: safeDed,
            platform_fee: platformFee,
          }
        })

      // Tarik Ecommerce Sales (Shopee, TikTok Shop, Web SS Online) identik 1:1 dengan admin-dashboard
      const allEcommerceRows: SalesSummaryRow[] = []
      if (filter.outletId === 'all' || filter.outletId === 'ss-online') {
        const fromIso = new Date(`${filter.from}T00:00:00+07:00`).toISOString()
        const toIso = new Date(`${filter.to}T23:59:59.999+07:00`).toISOString()
        const ecommerceSalesList: any[] = []
        try {
          let offset = 0
          while (true) {
            const { data: ePage, error: eErr } = await supabase
              .from('ecommerce_sales')
              .select('id, channel_id, order_date, total_amount, raw_data')
              .gte('order_date', fromIso)
              .lte('order_date', toIso)
              .order('order_date', { ascending: true })
              .order('id', { ascending: true })
              .range(offset, offset + 999)
            if (eErr) throw eErr
            const page = ePage ?? []
            ecommerceSalesList.push(...page)
            if (page.length < 1000) break
            offset += 1000
          }
        } catch (ecommerceError) {
          console.error('useSalesDaily finance ecommerce error:', ecommerceError)
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
          let salesSource = 'online'
          if (chNorm.includes('tiktok') || chNorm === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5') {
            salesSource = 'tiktok_shop'
          } else if (chNorm.includes('shopee') || chNorm === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584') {
            salesSource = 'shopee_shop'
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
    },
  })

  const rows = useMemo<SalesSummaryRow[]>(() => {
    const base = query.data ?? []
    if (!outlets || outlets.length === 0) return base
    const nameById = new Map(outlets.map((o) => [o.id, o.name]))
    return base.map((r) => ({
      ...r,
      outlet_name: nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
    }))
  }, [query.data, outlets])

  return { rows, loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
