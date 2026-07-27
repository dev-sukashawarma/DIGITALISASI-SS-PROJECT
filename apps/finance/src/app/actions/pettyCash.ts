'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@suka/auth'
import { DisbursementMethod } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

async function getSupabaseClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
  }
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

export async function processPettyCashFinanceCustomAmount({
  id,
  action,
  method = 'transfer',
  cashLocationId,
  proofOfTransferUrl,
  approvedAmount,
  approvalNote,
  userId
}: {
  id: string
  action: 'approve' | 'reject'
  method?: DisbursementMethod
  cashLocationId?: string
  proofOfTransferUrl?: string
  approvedAmount?: number
  approvalNote?: string
  userId: string
}) {
  try {
    const supabase = await getSupabaseClient()

    const { data: topup, error: fetchError } = await supabase
      .from('petty_cash_topups')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !topup) {
      console.error('Fetch topup error in server action:', fetchError)
      throw new Error(`Top up request not found (${fetchError?.message || 'No row returned'})`)
    }

    if (topup.status !== 'forwarded_to_finance') {
      throw new Error(`Top up is not ready for finance processing (status: ${topup.status})`)
    }

    const validUserId = (userId && userId !== '00000000-0000-0000-0000-000000000000') ? userId : null

    if (action === 'approve') {
      const finalAmount = approvedAmount ?? topup.amount
      
      let newDescription = topup.description
      if (approvalNote) {
        newDescription = `${topup.description}\n\n(Catatan Finance: ${approvalNote})`
      }

      const { error: updateError } = await supabase
        .from('petty_cash_topups')
        .update({
          status: 'approved_by_finance',
          finance_approved_by: validUserId,
          disbursement_method: method,
          disbursed_from_cash_location_id: cashLocationId || null,
          proof_of_transfer_url: proofOfTransferUrl || null,
          amount: finalAmount,
          description: newDescription
        })
        .eq('id', id)

      if (updateError) throw updateError

      if (cashLocationId) {
        const { error: cashError } = await supabase
          .from('cash_transaction')
          .insert({
            cash_location_id: cashLocationId,
            amount: finalAmount,
            direction: 'out',
            source_type: 'petty_cash_topup',
            source_id: id,
            note: `Pencairan Petty Cash Outlet (${method})`,
            occurred_at: new Date().toISOString(),
            created_by: validUserId
          })

        if (cashError) {
          console.error('Warning inserting cash_transaction:', cashError)
        }
      }
    } else if (action === 'reject') {
      const { error: rejectError } = await supabase
        .from('petty_cash_topups')
        .update({
          status: 'rejected',
          finance_approved_by: validUserId
        })
        .eq('id', id)

      if (rejectError) throw rejectError
    } else {
      throw new Error(`Invalid action: ${action}`)
    }

    revalidatePath('/petty-cash')
    revalidatePath('/area-manager/petty-cash')

    return { success: true }
  } catch (err: any) {
    console.error('Error in processPettyCashFinanceCustomAmount:', err)
    return { success: false, error: err?.message || 'Gagal memproses pencairan' }
  }
}
