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
  source: 'monthly' | 'petty_cash'
}

export function useExpenses(filter: PeriodFilterValue) {
  const supabase = createClient()
  const query = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q1 = supabase
        .from('expenses')
        .select('id, outlet_id, category, amount, description, expense_date, period_month, receipt_url, outlets(name)')
        .gte('expense_date', filter.from)
        .lte('expense_date', filter.to)

      let q2 = supabase
        .from('petty_cash_expenses')
        .select('id, outlet_id, category, amount, description, expense_date, receipt_url, outlets(name)')
        .in('category', ['operasional', 'utilitas', 'lainnya'])
        .gte('expense_date', filter.from)
        .lte('expense_date', filter.to)

      // Filter outlet: satu outlet → hanya baris outlet itu (pusat/NULL tak muncul).
      if (filter.outletId !== 'all') {
        q1 = q1.eq('outlet_id', filter.outletId)
        q2 = q2.eq('outlet_id', filter.outletId)
      }

      const [res1, res2] = await Promise.all([q1, q2])

      if (res1.error) throw res1.error
      if (res2.error) throw res2.error

      const monthlyRows = (res1.data ?? []).map((row: any) => ({
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
        source: 'monthly' as const
      }))

      const pettyCashRows = (res2.data ?? []).map((row: any) => ({
        id: row.id,
        outlet_id: row.outlet_id,
        outlet_name: row.outlets?.name ?? (row.outlet_id ? 'Outlet Tidak Dikenal' : null),
        category: row.category,
        scope: 'outlet' as const, // petty cash selalu di outlet
        amount: Number(row.amount),
        description: row.description ?? '',
        expense_date: row.expense_date,
        period_month: row.expense_date.slice(0, 7) + '-01', // Fallback month start
        receipt_url: row.receipt_url,
        source: 'petty_cash' as const
      }))

      return [...monthlyRows, ...pettyCashRows] as ExpenseRow[]
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
