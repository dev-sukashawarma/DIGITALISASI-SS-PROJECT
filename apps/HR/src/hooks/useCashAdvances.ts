'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { CashAdvance, CashAdvancePayment } from '@/lib/types'
import { isTestOrDevStaff } from '@/lib/staffFilters'

interface CashAdvanceRow extends CashAdvance {
  outlet_staff: {
    name: string
    role: string
  }
  cash_advance_payments: CashAdvancePayment[]
}

export function useCashAdvances() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Realtime subscription for cash advances and payments
  useEffect(() => {
    const channel = supabase
      .channel('cash-advances-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_advances' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cash-advances'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_advance_payments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cash-advances'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return useQuery<CashAdvanceRow[]>({
    queryKey: ['cash-advances'],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_advances')
        .select(`
          *,
          outlet_staff!cash_advances_staff_id_fkey(name, role),
          cash_advance_payments(
            id,
            amount,
            payment_date,
            note,
            created_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      const rawData = (data as unknown as CashAdvanceRow[]) ?? []
      return rawData.filter((r) => !isTestOrDevStaff(r.outlet_staff))
    },
  })
}

export type { CashAdvanceRow }
