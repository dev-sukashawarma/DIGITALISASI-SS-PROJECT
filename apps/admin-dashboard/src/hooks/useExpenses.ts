'use client'

import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PeriodFilterValue } from '@/lib/types'
import { mapExpenseRow, type ExpenseRow } from '@/lib/expenseRow'
import { getExpensesAction } from '@/app/actions/expenses'
import { createClient } from '@/lib/supabase'
import { isTestOutlet } from '@/lib/outletFilters'
import { buatSaringanKasKecil } from '@/lib/kasKecilTeraudit'

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

      const expenses = res.expenses ?? []
      const pettyCash = res.pettyCashExpenses ?? []

      const monthlyRows = (expenses ?? [])
        .filter((row: any) => !row.outlet_id || (!isTestOutlet(row.outlet_id) && !isTestOutlet(row.outlets?.name)))
        .map(mapExpenseRow)

      const pettyCashRows = (pettyCash ?? [])
        .filter((row: any) => !isTestOutlet(row.outlet_id) && !isTestOutlet(row.outlets?.name))
        .map((row: any) => {
          let cat = row.category
          if (cat === 'bb') cat = 'bahan_baku'
          else if (cat === 'outlet' || cat === 'operasional') cat = 'pengeluaran_outlet'
          else if (cat === 'utilities') cat = 'utilitas'

          return {
            id: row.id,
            outlet_id: row.outlet_id,
            outlet_name: row.outlets?.name ?? (row.outlet_id ? 'Outlet Tidak Dikenal' : null),
            category: cat,
            scope: 'outlet' as const,
            amount: Number(row.amount) || 0,
            description: row.description ?? '',
            expense_date: row.expense_date,
            period_month: (row.expense_date || '').slice(0, 7) + '-01',
            receipt_url: row.receipt_url,
            source: 'petty_cash' as const,
            type: 'expense',
            recipient_name: null,
            division: null,
            raw_description: row.description,
            raw_category: row.category,
          } as ExpenseRow
        })

      // Kas kecil dilewati hanya untuk outlet-bulan yang sudah punya rangkuman
      // "OPEX <Bulan> <Tahun> - ..." di expenses — lihat lib/kasKecilTeraudit.ts.
      const filteredPettyCashRows = pettyCashRows.filter(buatSaringanKasKecil(monthlyRows))

      return [...monthlyRows, ...filteredPettyCashRows] as ExpenseRow[]
    },
  })
  return { 
    rows: query.data ?? EMPTY_ROWS, 
    loading: query.isLoading, 
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch
  }
}
