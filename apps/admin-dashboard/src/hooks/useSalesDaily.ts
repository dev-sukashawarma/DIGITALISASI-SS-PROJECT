'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { SalesSummaryRow, PeriodFilterValue, SalesSource } from '@/lib/types'

// Ringkasan harian per outlet × sumber langsung dari view DB `sales_daily_scoped`.
// Untuk halaman yang HANYA butuh agregat harian (mis. Profit) — rentang lebar
// tak perlu mengirim baris per-jam ke browser. Return shape sama dengan
// useSalesSummary agar konsumen tak berubah.
export function useSalesDaily(filter: PeriodFilterValue, outlets?: { id: string; name: string }[]) {
  const supabase = createClient()
  const query = useQuery<SalesSummaryRow[]>({
    queryKey: ['sales-daily', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const PAGE_SIZE = 1000
      const all: any[] = []
      let offset = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from('sales_daily_scoped')
          .select('outlet_id, sales_source, sales_date, omzet, jumlah_order_completed')
          .gte('sales_date', filter.from)
          .lte('sales_date', filter.to)
        if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
        if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
        const { data, error } = await q.range(offset, offset + PAGE_SIZE - 1)
        if (error) throw error
        const page = data ?? []
        all.push(...page)
        if (page.length < PAGE_SIZE) break
        offset += PAGE_SIZE
      }
      // 2. Fetch orders for deductions (discount_amount + promo_subsidy + platform_fee)
      // Fix timezone bounds for +07:00
      const fromStart = new Date(`${filter.from}T00:00:00.000+07:00`)
      const toEnd = new Date(`${filter.to}T23:59:59.999+07:00`)
      
      let ordersQ = supabase
        .from('orders')
        .select('outlet_id, created_at, discount_amount, promo_subsidy, channel, sales_source, total_amount, order_items(subtotal)')
        .eq('status', 'completed')
        .gte('created_at', fromStart.toISOString())
        .lte('created_at', toEnd.toISOString())
        
      if (filter.outletId !== 'all') ordersQ = ordersQ.eq('outlet_id', filter.outletId)
      
      let settlementQ = supabase
        .from('platform_settlements')
        .select('outlet_id, sales_date, platform, gross_amount, platform_fee, promo_merchant')
        .gte('sales_date', filter.from)
        .lte('sales_date', filter.to)
      if (filter.outletId !== 'all') settlementQ = settlementQ.eq('outlet_id', filter.outletId)
      
      const [ { data: ordersData, error: ordersErr }, { data: settlementData, error: settlementErr } ] = await Promise.all([ ordersQ, settlementQ ])
      
      if (ordersErr) console.error("Error fetching orders for deductions", ordersErr)
      if (settlementErr) console.error("Error fetching settlements", settlementErr)
      
      const settlementMap = new Map<string, any>()
      for (const s of settlementData || []) {
        let srcKey = s.platform.toLowerCase()
        if (srcKey === 'tiktokgo') srcKey = 'tiktok'
        const key = `${s.outlet_id}|${srcKey}|${s.sales_date}`
        settlementMap.set(key, s)
      }
      
      const deductionsMap = new Map<string, { discount: number, platformFee: number }>()
      for (const o of ordersData || []) {
        const d = new Date(o.created_at)
        const localDate = new Date(d.getTime() + 7 * 3600 * 1000)
        const dateStr = localDate.toISOString().split('T')[0]
        
        const srcKey = String(o.sales_source || 'pos').toLowerCase()
        
        if (filter.source !== 'all' && srcKey !== filter.source.toLowerCase()) continue;
        
        const key = `${o.outlet_id}|${srcKey}|${dateStr}`
        
        let discount = 0
        const disc = Number(o.discount_amount) || 0
        const promo = Number(o.promo_subsidy) || 0
        if (disc > 0 || promo > 0) {
          discount = disc + promo
        } else {
          const itemSubtotal = (o.order_items || []).reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0)
          const totalAmt = Number(o.total_amount) || 0
          discount = itemSubtotal > totalAmt ? itemSubtotal - totalAmt : 0
        }
        
        let platformFee = 0 // Removed 20% estimation to match ReportsView and ownerDashboard logic
        
        const existing = deductionsMap.get(key) || { discount: 0, platformFee: 0 }
        existing.discount += discount
        existing.platformFee += platformFee
        deductionsMap.set(key, existing)
      }

      return all.map((r: any) => {
        const src = (r.sales_source || 'pos').toLowerCase()
        const key = `${r.outlet_id}|${src}|${r.sales_date}`
        const ded = deductionsMap.get(key) || { discount: 0, platformFee: 0 }
        const setl = settlementMap.get(key)
        
        let platform_fee = ded.platformFee || 0
        let promo_merchant = 0
        let selisih_pencatatan = 0
        
        if (setl) {
          platform_fee = setl.platform_fee || 0
          promo_merchant = setl.promo_merchant || 0
          const posGross = Number(r.omzet) || 0
          const setlGross = Number(setl.gross_amount) || 0
          selisih_pencatatan = posGross - setlGross
        }

        return {
          outlet_id: r.outlet_id,
          outlet_name: '',
          sales_source: r.sales_source as SalesSource,
          sales_date: r.sales_date,
          omzet: Number(r.omzet),
          jumlah_order_completed: Number(r.jumlah_order_completed),
          jumlah_order_all: Number(r.jumlah_order_completed),
          total_deductions: ded.discount,
          platform_fee: platform_fee,
          promo_merchant: promo_merchant,
          selisih_pencatatan: selisih_pencatatan,
        }
      })
    },
  })

  // Resolusi nama outlet dari daftar yang sudah dimuat caller (useOutlets()).
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
