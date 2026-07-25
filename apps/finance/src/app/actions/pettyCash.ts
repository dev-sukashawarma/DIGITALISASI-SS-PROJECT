'use server'

import { createClient } from '@supabase/supabase-js'
import { DisbursementMethod } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const { data: topup, error: fetchError } = await supabase
      .from('petty_cash_topups')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !topup) {
      throw new Error('Top up request not found')
    }

    if (topup.status !== 'forwarded_to_finance') {
      throw new Error(`Top up is not ready for finance processing (status: ${topup.status})`)
    }

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
          finance_approved_by: userId,
          disbursement_method: method,
          disbursed_from_cash_location_id: cashLocationId,
          proof_of_transfer_url: proofOfTransferUrl,
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
            created_by: userId
          })

        if (cashError) throw cashError
      }
    } else if (action === 'reject') {
      const { error: rejectError } = await supabase
        .from('petty_cash_topups')
        .update({
          status: 'rejected',
          finance_approved_by: userId
        })
        .eq('id', id)

      if (rejectError) throw rejectError
    } else {
      throw new Error(`Invalid action: ${action}`)
    }

    return { success: true }
  } catch (err: any) {
    console.error('Error in processPettyCashFinanceCustomAmount:', err)
    return { success: false, error: err.message }
  }
}
