'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@suka/auth'
import { DisbursementMethod } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

async function getSupabaseClient() {
  return createClient(supabaseUrl, serviceRoleKey)
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
      if (approvalNote && approvalNote.trim()) {
        if (approvedAmount && approvedAmount !== topup.amount) {
          newDescription = `${topup.description}\n\n📌 [Catatan Finance (Acc Rp ${finalAmount.toLocaleString('id-ID')} dari Diajukan Rp ${topup.amount.toLocaleString('id-ID')}): ${approvalNote.trim()}]`
        } else {
          newDescription = `${topup.description}\n\n📌 [Catatan Finance: ${approvalNote.trim()}]`
        }
      } else if (approvedAmount && approvedAmount !== topup.amount) {
        newDescription = `${topup.description}\n\n📌 [Catatan Finance: Nominal disetujui Rp ${finalAmount.toLocaleString('id-ID')} dari diajukan Rp ${topup.amount.toLocaleString('id-ID')}]`
      }

      const { data: updateData, error: updateError } = await supabase
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
        .select()

      if (updateError) throw updateError
      if (!updateData || updateData.length === 0) {
        throw new Error('Gagal memperbarui status pencairan di database.')
      }

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
      const { data: rejectData, error: rejectError } = await supabase
        .from('petty_cash_topups')
        .update({
          status: 'rejected',
          finance_approved_by: validUserId
        })
        .eq('id', id)
        .select()

      if (rejectError) throw rejectError
      if (!rejectData || rejectData.length === 0) {
        throw new Error('Gagal memperbarui status penolakan di database.')
      }
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
