'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { SalesSummaryRow, PeriodFilterValue } from '@/lib/types'

// Sumber data: sales_hourly_spv (agregat per outlet × sumber × tanggal × jam,
// pola SPV definer/bypass-RLS yang sama dengan sales_summary_spv) + nama outlet
// dari tabel outlets. Hourly digabung jadi ringkasan harian per outlet × sumber.
// Catatan: dipakai sebagai pengganti view sales_summary_spv yang sempat drift di
// remote (kehilangan kolom outlet_name/sales_source). Kedua view membaca tabel
// `orders` dengan filter status='completed' yang sama, jadi angkanya identik.
export function useSalesSummary(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<SalesSummaryRow[]>({
    queryKey: ['sales-summary', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from('sales_hourly_spv')
        .select('outlet_id, sales_source, sales_date, omzet, jumlah_order_completed')
        .gte('sales_date', filter.from)
        .lte('sales_date', filter.to)
      if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
      if (filter.source !== 'all') q = q.eq('sales_source', filter.source)

      const [hourlyRes, outletsRes] = await Promise.all([
        q,
        supabase.from('outlets').select('id, name'),
      ])
      if (hourlyRes.error) throw hourlyRes.error
      if (outletsRes.error) throw outletsRes.error

      const nameById = new Map<string, string>()
      for (const o of (outletsRes.data ?? []) as { id: string; name: string }[]) {
        nameById.set(o.id, o.name)
      }

      // Gabungkan baris per-jam menjadi ringkasan harian per outlet × sumber.
      const acc = new Map<string, SalesSummaryRow>()
      for (const r of (hourlyRes.data ?? []) as any[]) {
        const key = `${r.outlet_id}|${r.sales_source}|${r.sales_date}`
        const omzet = Number(r.omzet)
        const completed = Number(r.jumlah_order_completed)
        const existing = acc.get(key)
        if (existing) {
          existing.omzet += omzet
          existing.jumlah_order_completed += completed
          existing.jumlah_order_all += completed
        } else {
          acc.set(key, {
            outlet_id: r.outlet_id,
            outlet_name: nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
            sales_source: r.sales_source,
            sales_date: r.sales_date,
            omzet,
            jumlah_order_completed: completed,
            jumlah_order_all: completed,
          })
        }
      }
      return Array.from(acc.values())
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
