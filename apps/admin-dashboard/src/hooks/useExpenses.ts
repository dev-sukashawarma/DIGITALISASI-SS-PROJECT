'use client'

import { useQuery } from '@tanstack/react-query'
import type { PeriodFilterValue } from '@/lib/types'
import { mapExpenseRow, type ExpenseRow } from '@/lib/expenseRow'
import { getExpensesAction } from '@/app/actions/expenses'

export type { ExpenseRow } from '@/lib/expenseRow'

const EMPTY_ROWS: ExpenseRow[] = []

export function useExpenses(filter: PeriodFilterValue, initialData?: ExpenseRow[]) {
  const query = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', filter.from, filter.to, filter.outletId],
    initialData,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await getExpensesAction({
        from: filter.from,
        to: filter.to,
        outletId: filter.outletId,
        source: filter.source
      })

      if (res && 'success' in res && !res.success) {
        throw new Error(res.error || 'Gagal memuat data pengeluaran dari server')
      }

      const expenses = res.expenses ?? []

      const monthlyRows = (expenses ?? []).map(mapExpenseRow)

      return monthlyRows as ExpenseRow[]
    },
  })
  return { 
    rows: query.data ?? EMPTY_ROWS, 
    loading: query.isLoading, 
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch
  }
}
