'use client'

import { createSupabaseBrowserClient } from '@suka/auth'
import { useQuery } from '@tanstack/react-query'

export interface CrewBonusRow {
  crew_id: string
  crew_name: string
  role: string
  outlet_id: string
  outlet_name: string
  total_pcs_outlet: number
  active_crew_count: number
  bonus_rate: number
  total_bonus: number
}

export interface AMBonusRow {
  staff_id: string
  staff_name: string
  role: string
  managed_outlet_count: number
  managed_outlet_names: string[]
  total_pcs: number
  bonus_rate: number
  total_bonus: number
}

export interface RMBonusRow {
  staff_id: string
  staff_name: string
  role: string
  scope_description: string
  total_pcs_global: number
  bonus_rate: number
  total_bonus: number
}

export interface BonusSummaryData {
  total_pcs_global: number
  total_crew_bonus: number
  total_am_bonus: number
  total_rm_bonus: number
  grand_total_bonus: number
  active_crew_count: number
  active_am_count: number
  active_rm_count: number
}

interface BaseParams {
  month: number
  year: number
}

export function useMonthlyBonusSummary({ month, year }: BaseParams) {
  const supabase = createSupabaseBrowserClient()

  return useQuery<BonusSummaryData | null>({
    queryKey: ['monthly_bonus_summary', month, year],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_bonus_summary', {
        p_month: month,
        p_year: year,
      })

      if (error) {
        console.error('Error fetching monthly bonus summary:', error)
        throw error
      }

      if (!data || data.length === 0) return null

      const r = data[0]
      return {
        total_pcs_global: Number(r.total_pcs_global) || 0,
        total_crew_bonus: Number(r.total_crew_bonus) || 0,
        total_am_bonus: Number(r.total_am_bonus) || 0,
        total_rm_bonus: Number(r.total_rm_bonus) || 0,
        grand_total_bonus: Number(r.grand_total_bonus) || 0,
        active_crew_count: Number(r.active_crew_count) || 0,
        active_am_count: Number(r.active_am_count) || 0,
        active_rm_count: Number(r.active_rm_count) || 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

interface CrewBonusParams extends BaseParams {
  outletId: string | null
}

export function useMonthlyCrewBonus({ month, year, outletId }: CrewBonusParams) {
  const supabase = createSupabaseBrowserClient()

  return useQuery<CrewBonusRow[]>({
    queryKey: ['monthly_crew_bonus', month, year, outletId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_crew_bonus', {
        p_month: month,
        p_year: year,
        p_outlet_id: outletId || null,
      })

      if (error) {
        console.error('Error fetching monthly crew bonus:', error)
        throw error
      }

      return (data || []).map((r: any) => ({
        crew_id: r.crew_id,
        crew_name: r.crew_name || 'Tanpa Nama',
        role: r.role || 'crew',
        outlet_id: r.outlet_id,
        outlet_name: r.outlet_name || 'Unknown Outlet',
        total_pcs_outlet: Number(r.total_pcs_outlet) || 0,
        active_crew_count: Number(r.active_crew_count) || 0,
        bonus_rate: Number(r.bonus_rate) || 100,
        total_bonus: Number(r.total_bonus) || 0,
      }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useMonthlyAMBonus({ month, year }: BaseParams) {
  const supabase = createSupabaseBrowserClient()

  return useQuery<AMBonusRow[]>({
    queryKey: ['monthly_am_bonus', month, year],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_am_bonus', {
        p_month: month,
        p_year: year,
      })

      if (error) {
        console.error('Error fetching monthly AM bonus:', error)
        throw error
      }

      return (data || []).map((r: any) => ({
        staff_id: r.staff_id,
        staff_name: r.staff_name || 'Tanpa Nama',
        role: r.role || 'area_manager',
        managed_outlet_count: Number(r.managed_outlet_count) || 0,
        managed_outlet_names: Array.isArray(r.managed_outlet_names) ? r.managed_outlet_names : [],
        total_pcs: Number(r.total_pcs) || 0,
        bonus_rate: Number(r.bonus_rate) || 50,
        total_bonus: Number(r.total_bonus) || 0,
      }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useMonthlyRMBonus({ month, year }: BaseParams) {
  const supabase = createSupabaseBrowserClient()

  return useQuery<RMBonusRow[]>({
    queryKey: ['monthly_rm_bonus', month, year],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_rm_bonus', {
        p_month: month,
        p_year: year,
      })

      if (error) {
        console.error('Error fetching monthly RM bonus:', error)
        throw error
      }

      return (data || []).map((r: any) => ({
        staff_id: r.staff_id,
        staff_name: r.staff_name || 'Tanpa Nama',
        role: r.role || 'regional_manager',
        scope_description: r.scope_description || 'Semua Cabang Operasional',
        total_pcs_global: Number(r.total_pcs_global) || 0,
        bonus_rate: Number(r.bonus_rate) || 50,
        total_bonus: Number(r.total_bonus) || 0,
      }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Backwards compatibility alias
export const useCrewBonus = useMonthlyCrewBonus
