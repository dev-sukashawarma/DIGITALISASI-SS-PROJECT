'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { SalesSummaryRow, PeriodFilterValue, SalesSource } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

// Ringkasan harian per outlet × sumber langsung dari view DB `sales_daily_scoped`.
// Sangat cepat karena dihitung langsung di database menggunakan covering & functional indexes.
export function useSalesDaily(filter: PeriodFilterValue, outlets?: { id: string; name: string }[]) {
  const supabase = createClient()
  const query = useQuery<SalesSummaryRow[]>({
    queryKey: ['sales-daily', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      // PostgREST memotong hasil di 1.000 baris tanpa error apa pun. Rentang
      // 30 hari menghasilkan ~2.000 baris (outlet × sumber × tanggal), jadi
      // tanpa paginasi omzet yang tampil hanya ~50% dari yang sebenarnya —
      // dan karena tak ada ORDER BY, baris mana yang lolos pun tak menentu.
      // Halaman Untung Rugi & Rekap Bulanan sempat melaporkan rugi palsu
      // karena ini. Selalu ambil sampai halaman terakhir.
      const PAGE_SIZE = 1000
      const buildSalesQuery = () => {
        let b = supabase
          .from('sales_daily_scoped')
          .select('outlet_id, sales_source, sales_date, omzet, total_deductions, jumlah_order_completed')
          .neq('outlet_id', TEST_OUTLET_ID)
          .gte('sales_date', filter.from)
          .lte('sales_date', filter.to)
          .order('sales_date', { ascending: true })
          .order('outlet_id', { ascending: true })

        if (filter.outletId !== 'all') b = b.eq('outlet_id', filter.outletId)
        if (filter.source !== 'all') b = b.eq('sales_source', filter.source)
        return b
      }

      const salesData: any[] = []
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await buildSalesQuery().range(offset, offset + PAGE_SIZE - 1)
        if (error) throw error
        const page = data ?? []
        salesData.push(...page)
        if (page.length < PAGE_SIZE) break
      }

      // Catatan: query mentah ke `orders` yang dulu ada di sini (untuk menghitung
      // potongan per hari) sudah dihapus. View `sales_daily_scoped` sendiri sudah
      // menyediakan `total_deductions` dengan definisi yang sama persis
      // (terverifikasi identik pada data produksi), jadi query itu hanya menarik
      // puluhan ribu baris order tanpa menambah informasi apa pun — dan ia
      // sendiri ikut terpotong di 1.000 baris.
      const posRows: SalesSummaryRow[] = salesData
        .filter((r: any) => !isTestOutlet(r.outlet_id))
        .map((r: any) => {
          const totalDed = Number(r.total_deductions) || 0

          return {
            outlet_id: r.outlet_id,
            outlet_name: '',
            sales_source: r.sales_source as SalesSource,
            sales_date: r.sales_date,
            omzet: Number(r.omzet || 0),
            jumlah_order_completed: Number(r.jumlah_order_completed || 0),
            jumlah_order_all: Number(r.jumlah_order_completed || 0),
            total_deductions: totalDed,
            platform_fee: 0,
          }
        })

      // Batas hari Asia/Jakarta untuk query ecommerce (kolom order_date bertipe
      // timestamp, bukan date). Sebelumnya dihitung bersama query `orders` mentah
      // yang sudah dihapus, sehingga variabelnya sempat hilang.
      const fromIso = new Date(`${filter.from}T00:00:00+07:00`).toISOString()
      const toIso = new Date(`${filter.to}T23:59:59.999+07:00`).toISOString()

      // Fetch Ecommerce Sales (Shopee, TikTok Shop, Web SS Online) if applicable
      const allEcommerceRows: SalesSummaryRow[] = []
      if (filter.outletId === 'all' || filter.outletId === 'ss-online') {
        const PAGE_SIZE = 1000
        let offset = 0
        const ecommerceSalesList: any[] = []

        while (true) {
          const { data: page, error: ecommerceError } = await supabase
            .from('ecommerce_sales')
            .select('id, channel_id, order_date, total_amount, raw_data')
            .gte('order_date', fromIso)
            .lte('order_date', toIso)
            .order('order_date', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1)

          if (ecommerceError) {
            console.error('useSalesDaily ecommerce error:', ecommerceError)
            break
          }
          if (!page || page.length === 0) break
          ecommerceSalesList.push(...page)
          if (page.length < PAGE_SIZE) break
          offset += PAGE_SIZE
        }

        const ecommerceSummaryMap = new Map<string, SalesSummaryRow>()
        for (const saleRecord of ecommerceSalesList) {
          const raw = saleRecord.raw_data || {}
          const totalPotongan = Math.abs(Number(raw.total_potongan || raw.admin_fee || raw.discount_amount) || 0)
          const omzetKotor = Number(saleRecord.total_amount) || 0
          const omzetNet = Math.max(0, omzetKotor - totalPotongan)

          const d = new Date(saleRecord.order_date)
          const dateStr = new Date(d.getTime() + (7 * 60 * 60 * 1000)).toISOString().split('T')[0]

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

