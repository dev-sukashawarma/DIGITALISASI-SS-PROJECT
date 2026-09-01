import { useQuery } from '@tanstack/react-query'
import type { PeriodFilterValue } from '@/lib/types'
import { deriveScope, type ExpenseCategory, type ExpenseScope } from '@/lib/expenseCategories'
import { getExpensesAction } from '@/app/actions/expenses'

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
  type?: string
  recipient_name?: string | null
  division?: string | null
}

const EMPTY_ROWS: ExpenseRow[] = []

export function useExpenses(filter: PeriodFilterValue, initialData?: ExpenseRow[]) {
  const query = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', filter.from, filter.to, filter.outletId],
    initialData,
    staleTime: 30_000,
    queryFn: async () => {
      const { expenses, pettyCashExpenses } = await getExpensesAction({
        from: filter.from,
        to: filter.to,
        outletId: filter.outletId,
        source: filter.source
      })

      const monthlyRows = (expenses ?? []).map((row: any) => {
        let displayDesc = row.description ?? ''
        let cat = row.category
        let recipientName: string | null = null
        let division: string | null = null

        if (displayDesc.includes('[OFFICE_VCR]')) {
          try {
            const jsonPart = displayDesc.split('[OFFICE_VCR] ')[1]?.split(' | ')[0]
            if (jsonPart) {
              const parsed = JSON.parse(jsonPart)
              if (parsed.cat) cat = parsed.cat
              if (parsed.rcp) recipientName = parsed.rcp
              if (parsed.div) division = parsed.div
              if (parsed.rsn) displayDesc = parsed.rsn
            }
          } catch (e) {
            // ignore
          }
        }

        return {
          id: row.id,
          outlet_id: row.outlet_id,
          outlet_name: row.outlets?.name ?? (row.outlet_id ? 'Outlet Tidak Dikenal' : 'Kantor Pusat'),
          category: cat,
          scope: row.outlet_id ? deriveScope(cat) : ('pusat' as const),
          amount: Number(row.amount),
          description: displayDesc,
          expense_date: row.expense_date,
          period_month: row.period_month,
          receipt_url: row.receipt_url,
          type: row.type || 'expense',
          source: 'monthly' as const,
          recipient_name: recipientName,
          division: division
        }
      })

      return monthlyRows as ExpenseRow[]
    },
  })
  return { rows: query.data ?? EMPTY_ROWS, loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
