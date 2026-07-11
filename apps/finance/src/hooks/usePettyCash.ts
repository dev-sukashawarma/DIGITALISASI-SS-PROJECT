'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PettyCashTopup, DisbursementMethod } from '@/lib/types'

export function usePettyCashRequests(status?: string) {
  const supabase = useMemo(() => createClient(), [])

  return useQuery<PettyCashTopup[]>({
    queryKey: ['petty_cash_topups', status],
    queryFn: async () => {
      let query = supabase
        .from('petty_cash_topups')
        .select(`
          *,
          shifts(
            outlet_staff(name)
          )
        `)
        .order('created_at', { ascending: false })
      
      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error

      // Flatten the joined data
      return (data as any[]).map(row => ({
        ...row,
        outlet_staff: row.shifts?.outlet_staff ? { name: row.shifts.outlet_staff.name } : null
      })) as PettyCashTopup[]
    },
  })
}

export function useProcessPettyCashLeader() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const { error } = await supabase.rpc('review_petty_cash_topup', {
        p_topup_id: id,
        p_action: action
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_topups'] })
    }
  })
}

export function useProcessPettyCashFinance() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      id, 
      action, 
      method, 
      cashLocationId 
    }: { 
      id: string; 
      action: 'approve' | 'reject';
      method?: DisbursementMethod;
      cashLocationId?: string;
    }) => {
      const { error } = await supabase.rpc('finance_process_petty_cash', {
        p_topup_id: id,
        p_action: action,
        p_method: method || null,
        p_cash_location_id: cashLocationId || null
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_topups'] })
    }
  })
}
