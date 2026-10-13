'use server'

import { createClient } from '@supabase/supabase-js'
import { adalahJointExpenseDisembunyikan, PESAN_JOINT_EXPENSE_DITOLAK } from '@/lib/pengeluaran/jointExpense'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function importExpensesAction(rows: any[]) {
  if ((rows ?? []).some(adalahJointExpenseDisembunyikan)) {
    throw new Error(PESAN_JOINT_EXPENSE_DITOLAK)
  }

  // Use service role key to bypass RLS for bulk import
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { error } = await supabase
    .from('expenses')
    .insert(rows)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}
