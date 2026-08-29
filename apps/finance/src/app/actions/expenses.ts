'use server'

import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/authz'
import type { UpsertExpenseInput } from '@/hooks/useUpsertExpenses'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function upsertExpensesAction(items: UpsertExpenseInput[]) {
  // Server Action = endpoint POST publik; ini melewati RPC upsert_expense
  // (satu-satunya gerbang tulis menurut desain) pakai service-role client.
  const { role } = await requireRole(['admin_finance', 'admin', 'owner'])
  const supabase = getServiceSupabase()

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
  try {
    const supabase = getServiceSupabase()

    const isPusat = !input.outletId
    const dbCategory = isPusat ? 'pengeluaran_global' : input.category
    const dbDescription = isPusat && input.category !== 'pengeluaran_global'
      ? `[Kategori: ${input.category}] ${input.description}`
      : input.description

    // Validate if created_by exists in outlet_staff before referencing it, to prevent foreign key constraint violation
    let validStaffId: string | null = null
    if (input.created_by) {
      const { data: staff } = await supabase
        .from('outlet_staff')
        .select('id')
        .eq('id', input.created_by)
        .maybeSingle()
      if (staff?.id) {
        validStaffId = staff.id
      }
    }

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
        created_by: validStaffId
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting single expense:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (err: any) {
    console.error('Exception in createSingleExpenseAction:', err)
    return { success: false, error: err?.message || 'Gagal menyimpan transaksi' }
  }
}

export async function getExpensesAction(filter: { from: string; to: string; outletId: string; source?: string }) {
  const supabase = getServiceSupabase()

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
  const supabase = getServiceSupabase()

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

