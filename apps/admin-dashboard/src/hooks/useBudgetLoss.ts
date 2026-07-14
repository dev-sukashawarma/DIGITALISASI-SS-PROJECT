// apps/admin-dashboard/src/hooks/useBudgetLoss.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export interface BudgetLossRow {
  outlet_id: string
  budget_loss: number
}

// Budget Loss (alokasi BOM) per outlet untuk rentang periode, dari
// get_budget_loss_periode (scoped ke outlet yang boleh diakses pemanggil,
// sama pola dgn useHpp/useWaste).
export function useBudgetLoss(filter: PeriodFilterValue) {
  const supabase = createClient()
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
