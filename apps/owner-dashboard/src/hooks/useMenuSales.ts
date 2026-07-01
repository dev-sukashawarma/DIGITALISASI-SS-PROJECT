'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import type { MenuSalesRow, PeriodFilterValue } from '@/lib/types'

export function useMenuSales(filter: PeriodFilterValue) {
  const supabase = createSupabaseBrowserClient()
  const [rows, setRows] = useState<MenuSalesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
    let q = supabase.from('menu_sales_spv').select('*')
      .gte('sales_date', filter.from).lte('sales_date', filter.to)
    if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
    if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
    q.then(({ data, error }) => {
      if (!active) return
      if (error) setError(error.message)
      else setRows((data ?? []) as MenuSalesRow[])
      setLoading(false)
    })
    return () => { active = false }
  }, [supabase, filter.from, filter.to, filter.outletId, filter.source])

  return { rows, loading, error }
}
