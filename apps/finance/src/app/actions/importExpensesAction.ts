'use server'

import { getServiceSupabase } from '@/lib/supabase-service'
import { adalahJointExpenseDisembunyikan, PESAN_JOINT_EXPENSE_DITOLAK } from '@/lib/pengeluaran/jointExpense'

export async function importExpensesAction(rows: any[]) {
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
