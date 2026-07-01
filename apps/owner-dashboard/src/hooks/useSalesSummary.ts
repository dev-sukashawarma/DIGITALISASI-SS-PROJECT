'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import type { SalesSummaryRow, PeriodFilterValue } from '@/lib/types'

// Sumber data: sales_hourly_spv (agregat per outlet × sumber × tanggal × jam,
// pola SPV definer/bypass-RLS yang sama dengan sales_summary_spv) + nama outlet
// dari tabel outlets. Hourly digabung jadi ringkasan harian per outlet × sumber.
// Catatan: dipakai sebagai pengganti view sales_summary_spv yang sempat drift di
// remote (kehilangan kolom outlet_name/sales_source).
export function useSalesSummary(filter: PeriodFilterValue) {
  const supabase = createSupabaseBrowserClient()
  const [rows, setRows] = useState<SalesSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
    
    let q = supabase
      .from('sales_hourly_spv')
      .select('outlet_id, sales_source, sales_date, omzet, jumlah_order_completed')
      .gte('sales_date', filter.from)
      .lte('sales_date', filter.to)
      
    if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
    if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
    
    Promise.all([
      q,
      supabase.from('outlets').select('id, name')
    ]).then(([hourlyRes, outletsRes]) => {
      if (!active) return
      
      if (hourlyRes.error) {
        setError(hourlyRes.error.message)
        setLoading(false)
        return
      }
      if (outletsRes.error) {
        setError(outletsRes.error.message)
        setLoading(false)
        return
      }

      const nameById = new Map<string, string>()
      for (const o of (outletsRes.data ?? []) as { id: string; name: string }[]) {
        nameById.set(o.id, o.name)
      }

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
      
      setRows(Array.from(acc.values()))
      setLoading(false)
    }).catch((err) => {
      if (!active) return
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    })
    
    return () => { active = false }
  }, [supabase, filter.from, filter.to, filter.outletId, filter.source])

  return { rows, loading, error }
}
