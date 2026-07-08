'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function reviewPettyCash(id: string, action: 'approve' | 'reject') {
  try {
    const cookieStore = await cookies()
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    })

    const { error } = await supabase.rpc('review_petty_cash_topup', {
      p_topup_id: id,
      p_action: action
    })

    if (error) throw error

    revalidatePath('/dashboard/pos-admin/petty-cash')
    return { success: true }
  } catch (error: any) {
    console.error('Error reviewing petty cash:', error)
    return { success: false, error: error.message || 'Gagal memproses pengajuan' }
  }
}
