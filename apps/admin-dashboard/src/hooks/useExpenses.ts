'use client'

import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PeriodFilterValue } from '@/lib/types'
import type { ExpenseRow } from '@/lib/expenseRow'
import { getExpensesAction } from '@/app/actions/expenses'
import { createClient } from '@/lib/supabase'
import { susunBarisPengeluaran } from '@/lib/pengeluaran/susunBaris'

export type { ExpenseRow } from '@/lib/expenseRow'

const EMPTY_ROWS: ExpenseRow[] = []

export function useExpenses(filter: PeriodFilterValue, initialData?: ExpenseRow[]) {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const channel = supabase
      .channel('admin-expenses-realtime-sub')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['expenses'] })
          queryClient.invalidateQueries({ queryKey: ['profit'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'petty_cash_expenses' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['expenses'] })
          queryClient.invalidateQueries({ queryKey: ['profit'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])
  const query = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', filter.from, filter.to, filter.outletId, filter.source],
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

      return susunBarisPengeluaran(res.expenses ?? [], res.pettyCashExpenses ?? [])
    },
  })
  return { 
    rows: query.data ?? EMPTY_ROWS, 
    loading: query.isLoading, 
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch
  }
}
