'use server'

import { getServiceSupabase } from '@/lib/supabase-service'

export async function importExpensesAction(rows: any[]) {
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
