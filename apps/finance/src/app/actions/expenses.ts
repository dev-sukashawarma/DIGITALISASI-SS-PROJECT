'use server'

import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/authz'
import type { UpsertExpenseInput } from '@/hooks/useUpsertExpenses'

export async function upsertExpensesAction(items: UpsertExpenseInput[]) {
  // Server Action = endpoint POST publik; ini melewati RPC upsert_expense
  // (satu-satunya gerbang tulis menurut desain) pakai service-role client.
  const { role } = await requireRole(['admin_finance', 'admin', 'owner'])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso'
  const supabase = createClient(supabaseUrl, supabaseKey)

  for (const it of items) {
    const isPusat = ['pengeluaran_global', 'gaji_staff_kantor'].includes(it.category)
    // Scope Pusat (company-wide) owner-only, sesuai aturan RPC upsert_expense
    // yang dilewati di sini (CLAUDE.md § Pengeluaran Outlet vs Pusat).
    if (isPusat && role !== 'owner') {
      throw new Error('Forbidden: pengeluaran scope Pusat hanya boleh diisi owner')
    }
    const outletId = isPusat ? null : it.outletId

    // Insert directly using service role to bypass RLS and trigger issues
    // We explicitly set payment_source = 'transfer_pusat' to avoid the cash_drawer open shift trigger
    const { error } = await supabase.from('expenses').upsert({
      outlet_id: outletId,
      category: it.category,
      amount: it.amount,
      expense_date: it.periodMonth,
      period_month: it.periodMonth,
      payment_source: 'transfer_pusat'
    }, {
      onConflict: 'outlet_id, category, period_month'
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

export async function createSingleExpenseAction(input: {
  outletId: string | null
  category: string
  amount: number
  description: string
  expenseDate: string
  periodMonth: string
  type: string
  created_by?: string | null
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const isPusat = !input.outletId
  const dbCategory = isPusat ? 'pengeluaran_global' : input.category
  const dbDescription = isPusat && input.category !== 'pengeluaran_global'
    ? `[Kategori: ${input.category}] ${input.description}`
    : input.description

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      outlet_id: input.outletId,
      category: dbCategory,
      amount: input.amount,
      description: dbDescription,
      expense_date: input.expenseDate,
      period_month: input.periodMonth,
      type: input.type,
      payment_source: input.outletId ? 'petty_cash' : 'transfer_pusat',
      created_by: input.created_by || null
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getExpensesAction(filter: { from: string; to: string; outletId: string; source?: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  let q1 = supabase
    .from('expenses')
    .select('id, outlet_id, category, amount, description, expense_date, period_month, receipt_url, type, outlets(name)')
    .gte('expense_date', filter.from)
    .lte('expense_date', filter.to)

  let q2 = supabase
    .from('petty_cash_expenses')
    .select('id, outlet_id, category, amount, description, expense_date, receipt_url, type, outlets(name)')
    .in('category', ['operasional', 'utilitas', 'lainnya'])
    .gte('expense_date', filter.from)
    .lte('expense_date', filter.to)

  if (filter.outletId !== 'all') {
    q1 = q1.eq('outlet_id', filter.outletId)
    q2 = q2.eq('outlet_id', filter.outletId)
  }

  const [res1, res2] = await Promise.all([q1, q2])

  if (res1.error) throw res1.error
  if (res2.error) throw res2.error

  return {
    expenses: res1.data || [],
    pettyCashExpenses: res2.data || []
  }
}

export async function deleteTransactionAction(params: { id: string; isTopup?: boolean }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  if (params.isTopup || params.id.startsWith('topup-')) {
    const rawId = params.id.replace(/^topup-/, '')
    const { error } = await supabase
      .from('petty_cash_topups')
      .delete()
      .eq('id', rawId)
    if (error) throw new Error(error.message)
    return { success: true }
  }

  // Delete from expenses first
  const { error: err1 } = await supabase
    .from('expenses')
    .delete()
    .eq('id', params.id)

  // Also attempt delete from petty_cash_expenses if needed
  const { error: err2 } = await supabase
    .from('petty_cash_expenses')
    .delete()
    .eq('id', params.id)

  if (err1 && err2) {
    throw new Error(err1.message || err2.message)
  }

  return { success: true }
}
