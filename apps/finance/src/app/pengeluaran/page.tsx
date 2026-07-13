import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import ExpenseInputView from './ExpenseInputView'
import type { Outlet } from '@/lib/types'
import { deriveScope } from '@/lib/expenseCategories'

export const dynamic = 'force-dynamic'

function firstOfMonth(ym: string) { return `${ym}-01` }
function lastOfMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export default async function ExpenseInputPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const month = new Date().toISOString().slice(0, 7)
  const periodMonth = firstOfMonth(month)
  const periodEnd = lastOfMonth(month)

  const [
    { data: outlets },
    { data: res1 },
    { data: res2 },
  ] = await Promise.all([
    supabase
      .from('outlets')
      .select('id, slug, name, address, lat, lng, type, is_active')
      .order('name'),
    supabase
      .from('expenses')
      .select('id, outlet_id, category, amount, description, expense_date, period_month, receipt_url, outlets(name)')
      .gte('expense_date', periodMonth)
      .lte('expense_date', periodEnd),
    supabase
      .from('petty_cash_expenses')
      .select('id, outlet_id, category, amount, description, expense_date, receipt_url, outlets(name)')
      .in('category', ['operasional', 'utilitas', 'lainnya'])
      .gte('expense_date', periodMonth)
      .lte('expense_date', periodEnd),
  ])

  const monthlyRows = (res1 ?? []).map((row: any) => ({
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

  const pettyCashRows = (res2 ?? []).map((row: any) => ({
    id: row.id,
    outlet_id: row.outlet_id,
    outlet_name: row.outlets?.name ?? (row.outlet_id ? 'Outlet Tidak Dikenal' : null),
    category: row.category,
    scope: 'outlet' as const,
    amount: Number(row.amount),
    description: row.description ?? '',
    expense_date: row.expense_date,
    period_month: row.expense_date.slice(0, 7) + '-01',
    receipt_url: row.receipt_url,
    source: 'petty_cash' as const
  }))

  const initialExpenses = [...monthlyRows, ...pettyCashRows]

  return (
    <ExpenseInputView 
      initialOutlets={(outlets as Outlet[]) ?? []} 
      initialExpenses={initialExpenses}
    />
  )
}
