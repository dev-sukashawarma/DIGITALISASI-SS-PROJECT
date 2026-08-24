'use client'
import { useEffect } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

export interface TargetProgressRow {
  outlet_id: string
  outlet_name: string
  target_amount: number
  omzet_today: number
  date_value?: string
}

/**
 * Progress target harian semua outlet (untuk dashboard owner).
 * Realtime: refetch tiap ada perubahan tabel `orders` / `daily_sales_targets`.
 */
export function useTargetProgress(from?: string, to?: string) {
  const supabase = createSupabaseBrowserClient()
  const queryClient = useQueryClient()

  const { data: rows = [], isLoading: loading, refetch } = useQuery<TargetProgressRow[]>({
    queryKey: ['target_progress_global', from, to],
    queryFn: async () => {
      let query;
      if (from && to) {
        query = supabase.rpc('get_daily_target_progress_range', { p_start_date: from, p_end_date: to })
      } else {
        query = supabase.from('daily_target_progress_scoped').select('*')
      }

      const { data } = await query.order('outlet_name')
        
      return (data ?? [])
        .filter((r: any) => r.outlet_id !== TEST_OUTLET_ID && !isTestOutlet(r.outlet_id) && !isTestOutlet(r.outlet_name))
        .map((r: any) => ({
          outlet_id: r.outlet_id,
          outlet_name: r.outlet_name,
          target_amount: Number(r.target_amount) || 0,
          omzet_today: Number(r.omzet_today) || 0,
          date_value: r.date_value || new Date().toISOString().split('T')[0]
        }))
        .filter((r: TargetProgressRow) => {
          const lowerName = r.outlet_name.toLowerCase()
          return (
            !lowerName.includes('kantor pusat') &&
            !lowerName.includes('global outlet') &&
            !lowerName.includes('gudang pusat')
          )
        })
    },
    staleTime: 15000,
    refetchInterval: 30000,
  })

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>

    const scheduleRefetch = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['target_progress_global'] })
      }, 500)
    }

    const channelName = 'owner-target-progress'
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`)
    if (existing) supabase.removeChannel(existing)

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_sales_targets' }, scheduleRefetch)
      .subscribe()

    return () => {
      clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return { rows, loading, refetch }
}
