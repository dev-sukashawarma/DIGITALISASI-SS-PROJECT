'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'
import { deriveScope, type ExpenseCategory, type ExpenseScope } from '@/lib/expenseCategories'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

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

const EMPTY_ROWS: ExpenseRow[] = []

export function useExpenses(filter: PeriodFilterValue) {
  const supabase = createClient()
  const query = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const PAGE_SIZE = 1000

      const buildExpensesQuery = () => {
        let b = supabase
          .from('expenses')
          .select('id, outlet_id, category, amount, description, expense_date, period_month, receipt_url, outlets(name)')
          // `outlet_id <> X` bernilai NULL (bukan true) untuk baris ber-outlet_id NULL,
          // sehingga filter .neq() polos membuang SELURUH pengeluaran Pusat — yang
          // memang disimpan dengan outlet_id NULL. Kartu "Outlet + Pusat" karenanya
          // tak pernah memuat Pusat sama sekali. Baris NULL harus diloloskan eksplisit.
          .or(`outlet_id.is.null,outlet_id.neq.${TEST_OUTLET_ID}`)
          // Tabel `expenses` juga menampung baris pemasukan (type='income').
          // Tanpa saringan ini, pemasukan ikut dijumlahkan sebagai biaya.
          .eq('type', 'expense')
          .gte('expense_date', filter.from)
          .lte('expense_date', filter.to)
          .order('expense_date', { ascending: true })
          .order('id', { ascending: true })

        if (filter.outletId !== 'all') b = b.eq('outlet_id', filter.outletId)
        return b
      }

      const buildPettyCashQuery = () => {
        let b = supabase
          .from('petty_cash_expenses')
          .select('id, outlet_id, category, amount, description, expense_date, receipt_url, outlets(name)')
          .neq('outlet_id', TEST_OUTLET_ID)
          .in('category', ['bahan_baku', 'pengeluaran_outlet', 'operasional', 'utilitas', 'lainnya', 'bb', 'outlet', 'utilities'])
          .gte('expense_date', filter.from)
          .lte('expense_date', filter.to)
          .order('expense_date', { ascending: true })
          .order('id', { ascending: true })

        if (filter.outletId !== 'all') b = b.eq('outlet_id', filter.outletId)
        return b
      }

      // PostgREST memotong hasil di 1.000 baris tanpa error. `petty_cash_expenses`
      // sendiri sudah >1.400 baris per bulan, jadi tanpa paginasi biaya operasional
      // yang tampil hanya sebagian — dan tanpa ORDER BY, bagian mana pun tak menentu.
      const fetchAllPages = async (build: () => any) => {
        const all: any[] = []
        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data, error } = await build().range(offset, offset + PAGE_SIZE - 1)
          if (error) throw error
          const page = data ?? []
          all.push(...page)
          if (page.length < PAGE_SIZE) break
        }
        return all
      }

      const [expenseData, pettyCashData] = await Promise.all([
        fetchAllPages(buildExpensesQuery),
        fetchAllPages(buildPettyCashQuery),
      ])

      const monthlyRows = (expenseData ?? [])
        .filter((row: any) => !isTestOutlet(row.outlet_id) && !isTestOutlet(row.outlets?.name))
        .map((row: any) => ({
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

      const pettyCashRows = (pettyCashData ?? [])
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
          scope: 'outlet' as const, // petty cash selalu di outlet
          amount: Number(row.amount),
          description: row.description ?? '',
          expense_date: row.expense_date,
          period_month: row.expense_date.slice(0, 7) + '-01', // Fallback month start
          receipt_url: row.receipt_url,
          source: 'petty_cash' as const
        }
      })

      return [...monthlyRows, ...pettyCashRows] as ExpenseRow[]
    },
  })
  return { rows: query.data ?? EMPTY_ROWS, loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
