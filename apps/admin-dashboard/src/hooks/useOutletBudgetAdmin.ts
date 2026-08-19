'use client'

import { useQuery } from '@tanstack/react-query'
import { listOutletBudgets, setOutletBudgetConfig, type PeriodType } from '@/app/actions/budgetOutlet'

export function useOutletBudgetAdmin() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['outlet_budget_admin_list'],
    queryFn: () => listOutletBudgets(),
    staleTime: 15000,
    gcTime: 60000,
  })

  const save = async (outletId: string, nominal: number, periodType: PeriodType, customDays?: number | null) => {
    await setOutletBudgetConfig(outletId, nominal, periodType, customDays)
    await refetch()
  }

  return {
    budgets: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
    save,
  }
}
