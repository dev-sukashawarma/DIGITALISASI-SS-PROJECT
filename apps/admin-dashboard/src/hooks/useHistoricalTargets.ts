'use client'
import { useMemo } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useQuery } from '@tanstack/react-query'

export interface HistoricalTargetRow {
  id: string
  record_date: string
  outlet_id: string
  outlet_name: string
  target_amount: number
  omzet_achieved: number
  achieved_pct: number
}

export function useHistoricalTargets(filter: { from: string; to: string; outletId?: string | null }) {
  const supabase = createSupabaseBrowserClient()

  const startDate = filter.from
  const endDate = filter.to

  const { data: rows = [], isLoading, isError, error: queryError } = useQuery<HistoricalTargetRow[]>({
    queryKey: ['historical_targets', startDate, endDate, filter.outletId],
    queryFn: async () => {
      let query = supabase
        .from('historical_daily_targets')
        .select(`
          id,
          record_date,
          outlet_id,
          target_amount,
          omzet_achieved,
          achieved_pct,
          outlets ( name )
        `)
        .gte('record_date', startDate)
        .lte('record_date', endDate)
        .order('record_date', { ascending: false })
        .order('achieved_pct', { ascending: false })

      if (filter.outletId && filter.outletId !== 'all') {
        query = query.eq('outlet_id', filter.outletId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching historical targets:', error)
        throw error
      }

      return data.map((r: any) => ({
        id: r.id,
        record_date: r.record_date,
        outlet_id: r.outlet_id,
        outlet_name: r.outlets?.name || 'Unknown Outlet',
        target_amount: Number(r.target_amount),
        omzet_achieved: Number(r.omzet_achieved),
        achieved_pct: Number(r.achieved_pct),
      }))
    },
    staleTime: 5 * 60 * 1000,
  })

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, HistoricalTargetRow[]> = {}
    rows.forEach(row => {
      if (!groups[row.record_date]) groups[row.record_date] = []
      groups[row.record_date].push(row)
    })
    return groups
  }, [rows])

  return { rows, groupedByDate, isLoading, isError, error: queryError }
}
