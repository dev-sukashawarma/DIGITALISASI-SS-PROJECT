'use client'
import { useState, useMemo } from 'react'
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

export function useHistoricalTargets(year: number, month: number) {
  const supabase = createSupabaseBrowserClient()

  // Format YYYY-MM
  const monthStr = `${year}-${month.toString().padStart(2, '0')}`
  const startDate = `${monthStr}-01`
  // Get last day of month
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: rows = [], isLoading } = useQuery<HistoricalTargetRow[]>({
    queryKey: ['historical_targets', monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
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

      if (error) {
        console.error('Error fetching historical targets:', error)
        return []
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

  return { rows, groupedByDate, isLoading }
}
