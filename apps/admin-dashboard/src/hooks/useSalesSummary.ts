'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { SalesSummaryRow, PeriodFilterValue } from '@/lib/types'

export function useSalesSummary(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<SalesSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
    let q = supabase.from('sales_summary_spv').select('*')
      .gte('sales_date', filter.from).lte('sales_date', filter.to)
    if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
    if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
    q.then(({ data, error }) => {
      if (!active) return
      if (error) setError(error.message)
      else setRows((data ?? []) as SalesSummaryRow[])
      setLoading(false)
    })
    return () => { active = false }
  }, [supabase, filter.from, filter.to, filter.outletId, filter.source])

  return { rows, loading, error }
}
