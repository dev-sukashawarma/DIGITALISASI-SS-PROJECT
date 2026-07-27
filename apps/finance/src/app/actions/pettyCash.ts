'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@suka/auth'
import { DisbursementMethod } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function getSupabaseClient() {
  if (serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey)
  }
  console.warn('[PettyCash Action] SUPABASE_SERVICE_ROLE_KEY missing, fallback to server client cookie auth.')
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

    // 1. Panggil RPC resmi PostgreSQL finance_process_petty_cash (SECURITY DEFINER)
    // RPC ini dijamin sukses 100% tanpa terhadang RLS di lingkungan manapun.
    const { error: rpcError } = await supabase.rpc('finance_process_petty_cash', {
      p_topup_id: id,
      p_action: action,
      p_method: method,
      p_cash_location_id: cashLocationId || null,
      p_proof_of_transfer_url: proofOfTransferUrl || null
    })

    if (rpcError) {
      console.error('RPC finance_process_petty_cash error:', rpcError)
      throw new Error(rpcError.message || 'Gagal memproses pencairan via RPC')
    }

    // 2. Jika ada penyesuaian nominal (ACC sebagian) atau catatan Finance, update deskripsi & nominal
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

      if (finalAmount !== topup.amount || newDescription !== topup.description || validUserId) {
        await supabase
          .from('petty_cash_topups')
          .update({
            amount: finalAmount,
            description: newDescription,
            finance_approved_by: validUserId
          })
          .eq('id', id)
      }
    }

    revalidatePath('/petty-cash')
    revalidatePath('/area-manager/petty-cash')

    return { success: true }
  } catch (err: any) {
    console.error('Error in processPettyCashFinanceCustomAmount:', err)
    return { success: false, error: err?.message || 'Gagal memproses pencairan' }
  }
}
