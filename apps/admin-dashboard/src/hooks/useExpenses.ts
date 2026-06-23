'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export interface ExpenseRow {
  id: string
  outlet_id: string
  outlet_name: string
  category: 'bahan_baku' | 'gaji' | 'operasional' | 'sewa' | 'utilitas' | 'lainnya'
  amount: number
  description: string
  expense_date: string
}

export function useExpenses(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('id, outlet_id, category, amount, description, expense_date, outlets(name)')
        .gte('expense_date', filter.from)
        .lte('expense_date', filter.to)

      if (filter.outletId !== 'all') {
        q = q.eq('outlet_id', filter.outletId)
      }

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map((row: any) => ({
        id: row.id,
        outlet_id: row.outlet_id,
        outlet_name: row.outlets?.name ?? 'Outlet Tidak Dikenal',
        category: row.category,
        amount: Number(row.amount),
        description: row.description,
        expense_date: row.expense_date,
      })) as ExpenseRow[]
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
