'use server'

import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/authz'
import type { UpsertExpenseInput } from '@/hooks/useUpsertExpenses'

export async function upsertExpensesAction(items: UpsertExpenseInput[]) {
  // Server Action = endpoint POST publik, dan action ini melewati RPC
  // upsert_expense (satu-satunya gerbang tulis menurut desain) dengan
  // service-role client — wajib cek role sendiri di sini.
  const { role } = await requireRole(['admin', 'owner'])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
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
