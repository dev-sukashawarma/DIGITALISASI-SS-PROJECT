'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ExpenseCategory } from '@/lib/expenseCategories'
import { upsertExpensesAction } from '@/app/actions/expenses'

export interface UpsertExpenseInput {
  outletId: string | null   // null = pusat
  category: ExpenseCategory
  periodMonth: string        // 'YYYY-MM-01'
  amount: number
}

export function useUpsertExpenses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: UpsertExpenseInput[]) => {
      await upsertExpensesAction(items)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}
