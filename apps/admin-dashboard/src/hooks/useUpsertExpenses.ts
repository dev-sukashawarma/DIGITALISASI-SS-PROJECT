'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { ExpenseCategory } from '@/lib/expenseCategories'

export interface UpsertExpenseInput {
  outletId: string | null   // null = pusat
  category: ExpenseCategory
  periodMonth: string        // 'YYYY-MM-01'
  amount: number
}

export function useUpsertExpenses() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: UpsertExpenseInput[]) => {
      for (const it of items) {
        const { error } = await supabase.rpc('upsert_expense', {
          p_outlet: it.outletId,
          p_category: it.category,
          p_period_month: it.periodMonth,
          p_amount: it.amount,
          p_description: null,
        })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}
