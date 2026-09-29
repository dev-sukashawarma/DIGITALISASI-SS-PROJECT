'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import type { MenuSalesRow, PeriodFilterValue } from '@/lib/types'
import { fetchAllRows } from '@/lib/fetchAllRows'

export function useMenuSales(filter: PeriodFilterValue) {
  const supabase = createSupabaseBrowserClient()
  const [rows, setRows] = useState<MenuSalesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
    // Grain view = outlet × sumber × tanggal × menu_key (lihat definisi
    // menu_sales_spv). Dipaginasi dengan urutan unik di grain itu: dulu query
    // polos terpotong diam-diam di 1.000 baris sehingga "Menu Terlaris" kurang.
    // Kolom yang diambil = seluruh kolom view (sama dengan select('*') lama).
    const build = () => {
      let q = supabase
        .from('menu_sales_spv')
        .select('outlet_id, sales_source, sales_date, menu_key, menu_name, qty, revenue')
        .gte('sales_date', filter.from).lte('sales_date', filter.to)
      if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
      if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
      return q
        .order('sales_date', { ascending: true })
        .order('outlet_id', { ascending: true })
        .order('sales_source', { ascending: true })
        .order('menu_key', { ascending: true })
    }
    fetchAllRows<MenuSalesRow>(build).then(({ data, error }) => {
      if (!active) return
      if (error) setError(error)
      else setRows(data)
      setLoading(false)
    })
    return () => { active = false }
  }, [supabase, filter.from, filter.to, filter.outletId, filter.source])

  return { rows, loading, error }
}
