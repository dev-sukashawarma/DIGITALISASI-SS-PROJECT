'use server'

import { getServiceSupabase } from '@/lib/supabase-service'
import { requireRole, PERAN_KEUANGAN } from '@/lib/authz'
import { adalahJointExpenseDisembunyikan, PESAN_JOINT_EXPENSE_DITOLAK } from '@/lib/pengeluaran/jointExpense'

export async function importExpensesAction(rows: any[]) {
  await requireRole(PERAN_KEUANGAN)
  if ((rows ?? []).some(adalahJointExpenseDisembunyikan)) {
    throw new Error(PESAN_JOINT_EXPENSE_DITOLAK)
  }

  // Use service role key to bypass RLS for bulk import
  const supabase = getServiceSupabase()

  const { error } = await supabase
    .from('expenses')
    .insert(rows)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}
