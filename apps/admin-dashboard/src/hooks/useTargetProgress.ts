'use client'
import { useEffect } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface TargetProgressRow {
  outlet_id: string
  outlet_name: string
  target_amount: number
  omzet_today: number
}

/**
 * Progress target harian semua outlet (untuk dashboard owner).
 * Realtime: refetch tiap ada perubahan tabel `orders` / `daily_sales_targets`.
 */
export function useTargetProgress() {
  const supabase = createSupabaseBrowserClient()
  const queryClient = useQueryClient()

  const { data: rows = [], isLoading: loading, refetch } = useQuery<TargetProgressRow[]>({
    queryKey: ['target_progress_global'],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_target_progress_scoped')
        .select('*')
        .or(`outlet_name.neq.BustCache${Date.now()}`) // CACHE BUSTER IS MANDATORY FOR GET REQUESTS
        .order('outlet_name')
      return (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id,
        outlet_name: r.outlet_name,
        target_amount: Number(r.target_amount) || 0,
        omzet_today: Number(r.omzet_today) || 0,
      }))
    },
    staleTime: 0,
    refetchInterval: 3000,
  })

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>

    const scheduleRefetch = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['target_progress_global'] })
      }, 100)
    }

    const channel = supabase
      .channel('owner-target-progress')
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
