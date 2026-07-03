'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'
import { deriveScope, type ExpenseCategory, type ExpenseScope } from '@/lib/expenseCategories'

export interface ExpenseRow {
  id: string
  outlet_id: string | null
  outlet_name: string | null
  category: ExpenseCategory
  scope: ExpenseScope
  amount: number
  description: string
  expense_date: string
  period_month: string
  receipt_url?: string | null
}

export function useExpenses(filter: PeriodFilterValue) {
  const supabase = createClient()
  const query = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('id, outlet_id, category, amount, description, expense_date, period_month, receipt_url, outlets(name)')
        .gte('expense_date', filter.from)
        .lte('expense_date', filter.to)

      // Filter outlet: satu outlet → hanya baris outlet itu (pusat/NULL tak muncul).
      if (filter.outletId !== 'all') {
        q = q.eq('outlet_id', filter.outletId)
      }

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map((row: any) => ({
        id: row.id,
        outlet_id: row.outlet_id,
        outlet_name: row.outlets?.name ?? (row.outlet_id ? 'Outlet Tidak Dikenal' : null),
        category: row.category,
        scope: deriveScope(row.category),
        amount: Number(row.amount),
        description: row.description ?? '',
        expense_date: row.expense_date,
        period_month: row.period_month,
        receipt_url: row.receipt_url,
      })) as ExpenseRow[]
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
