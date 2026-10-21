'use client'

import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PeriodFilterValue } from '@/lib/types'
import type { ExpenseRow } from '@/lib/expenseRow'
import { susunBarisPengeluaran } from '@/lib/pengeluaran/susunBaris'
import { getExpensesAction } from '@/app/actions/expenses'
import { createClient } from '@/lib/supabase'

export type { ExpenseRow } from '@/lib/expenseRow'

export function useExpenses(filter: PeriodFilterValue, initialData?: ExpenseRow[]) {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const channel = supabase
      .channel('manager-expenses-realtime-sub')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['expenses'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'petty_cash_expenses' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['expenses'] })
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
    ...query,
    expenses: query.data ?? [],
    totalAmount: useMemo(
      () => (query.data ?? []).reduce((acc, row) => acc + (Number(row.amount) || 0), 0),
      [query.data]
    ),
  }
}
