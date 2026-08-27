'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

export interface BudgetLossRow {
  outlet_id: string
  budget_loss: number
}

export function useBudgetLoss(filter: { from: string; to: string; outletId: string }) {
  const supabase = createSupabaseBrowserClient()
  const query = useQuery<BudgetLossRow[]>({
    queryKey: ['budget_loss', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_budget_loss_periode', {
        p_from: filter.from,
        p_to: filter.to,
      })
      if (error) throw error
      let rows: BudgetLossRow[] = (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        budget_loss: Number(r.budget_loss),
      }))
      if (filter.outletId !== 'all') rows = rows.filter((r: BudgetLossRow) => r.outlet_id === filter.outletId)
      return rows
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
