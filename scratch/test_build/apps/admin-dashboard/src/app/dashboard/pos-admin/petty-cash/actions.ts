'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function processFinancePettyCash(
  id: string, 
  action: 'approve' | 'reject',
  method: 'transfer' | 'tunai' = 'transfer',
  cashLocationId?: string,
  proofOfTransferUrl?: string
) {
  try {
    const cookieStore = await cookies()
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    })

    const { error } = await supabase.rpc('finance_process_petty_cash', {
      p_topup_id: id,
      p_action: action,
      p_method: method,
      p_cash_location_id: cashLocationId || null,
      p_proof_of_transfer_url: proofOfTransferUrl || null
    })

    if (error) throw error

    revalidatePath('/dashboard/pos-admin/petty-cash')
    return { success: true }
  } catch (error: any) {
    console.error('Error reviewing petty cash:', error)
    return { success: false, error: error.message || 'Gagal memproses pengajuan' }
  }
}

export async function forwardFinanceFunds(id: string) {
  try {
    const cookieStore = await cookies()
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    })

    const { error } = await supabase.rpc('finance_forward_funds', {
      p_topup_id: id
    })

    if (error) throw error

    revalidatePath('/dashboard/pos-admin/petty-cash')
    return { success: true }
  } catch (error: any) {
    console.error('Error forwarding petty cash:', error)
    return { success: false, error: error.message || 'Gagal meneruskan dana' }
  }
}
