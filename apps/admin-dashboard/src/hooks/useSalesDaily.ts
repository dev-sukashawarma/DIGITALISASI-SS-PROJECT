'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { SalesSummaryRow, PeriodFilterValue, SalesSource } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'
import { fetchAllPagesParallel } from '@/lib/queryPaging'
import { periodCacheOptions, withPeriodCache } from '@/lib/periodCache'

// Ringkasan harian per outlet × sumber langsung dari view DB `sales_daily_scoped`.
// Sangat cepat karena dihitung langsung di database menggunakan covering & functional indexes.
export function useSalesDaily(filter: PeriodFilterValue, outlets?: { id: string; name: string }[]) {
  const supabase = createClient()
  const queryKey = ['sales-daily', filter.from, filter.to, filter.outletId, filter.source] as const
  const query = useQuery<SalesSummaryRow[]>({
    queryKey: [...queryKey],
    ...periodCacheOptions(filter),
    queryFn: withPeriodCache(queryKey, filter, async () => {
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
          // Urutan HARUS unik. Grain view ini adalah (outlet_id, sales_source,
          // sales_date) -- mengurut hanya dengan (sales_date, outlet_id)
          // menyisakan sampai 6 baris kembar (satu per sales_source), dan batas
          // halaman jatuh tepat di tengah kelompok kembar itu. Karena tiap
          // halaman adalah query terpisah, baris di dalam kelompok kembar bisa
          // terhitung dua kali atau terlewat. Ketiga kolom bersama-sama unik
          // (2.081 baris = 2.081 kombinasi).
          .order('sales_date', { ascending: true })
          .order('outlet_id', { ascending: true })
          .order('sales_source', { ascending: true })

        if (filter.outletId !== 'all') b = b.eq('outlet_id', filter.outletId)
        if (filter.source !== 'all') b = b.eq('sales_source', filter.source)
        return b
      }

      // SENGAJA berurutan, bukan paralel. `sales_daily_scoped` adalah view
      // beragregat: tiap halaman menjalankan ulang SELURUH agregasi (~2,4 detik
      // untuk satu bulan), jadi biayanya CPU database, bukan waktu tunggu
      // jaringan. Diukur pada data produksi Agustus 2026 (2.930 baris, 3
      // halaman): berurutan 7,3 detik vs paralel 7,7 detik — paralel tidak
      // membantu sama sekali, hanya menaruh tiga agregasi berat sekaligus di
      // database yang dipakai bersama app lain. Percepatan sesungguhnya untuk
      // view ini ada di sisi DB (RPC yang mengagregasi per outlet), bukan di
      // pola pengambilan halaman. Bandingkan `orders` di useHpp, yang justru
      // terikat jaringan sehingga paralel di sana memangkas 8,2 detik jadi 4,3.
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
        // Sama seperti di atas: halaman diambil bersamaan, bukan berurutan.
        // `order_date` saja bukan pengurut yang aman untuk paginasi — nilainya
        // disimpan sebagai tengah malam tiap hari, sehingga 1.377 baris hanya
        // punya ~30 timestamp unik. `id` dipakai sebagai pemecah seri agar
        // urutannya deterministik dan tak ada baris terhitung dua kali.
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
          // Perilaku lama dipertahankan: kegagalan sisi ecommerce tidak
          // menggagalkan seluruh laporan, cukup dicatat dan dilewati.
          console.error('useSalesDaily ecommerce error:', ecommerceError)
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
    }),
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

