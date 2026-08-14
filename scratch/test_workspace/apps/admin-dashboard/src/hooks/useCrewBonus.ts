'use client'

import { createSupabaseBrowserClient } from '@suka/auth'
import { useQuery } from '@tanstack/react-query'

export interface CrewBonusRow {
  crew_name: string
  role: string
  outlet_name: string
  days_target_reached: number
  total_bonus_received: number
}

interface UseCrewBonusParams {
  month: number
  year: number
  outletId: string | null
}

export function useCrewBonus({ month, year, outletId }: UseCrewBonusParams) {
  const supabase = createSupabaseBrowserClient()

  return useQuery<CrewBonusRow[]>({
    queryKey: ['crew_bonus', month, year, outletId],
    queryFn: async () => {
      if (!outletId) return []

      const { data, error } = await supabase.rpc('calculate_monthly_crew_bonus', {
        p_month: month,
        p_year: year,
        p_outlet_id: outletId,
      })

      if (error) {
        console.error('Error fetching monthly crew bonus:', error)
        throw error
      }

      return (data || []).map((r: any) => ({
        crew_name: r.crew_name || 'Tanpa Nama',
        role: r.role || 'Crew',
        outlet_name: r.outlet_name || 'Unknown Outlet',
        days_target_reached: Number(r.days_target_reached) || 0,
        total_bonus_received: Number(r.total_bonus_received) || 0,
      }))
    },
    enabled: !!outletId,
    staleTime: 5 * 60 * 1000,
  })
}
