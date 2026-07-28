'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@suka/auth'
import { requireRole } from '@/lib/authz'
import { DisbursementMethod } from '@/lib/types'

// Role yang benar-benar boleh memproses tahap Finance (approve/reject/forward
// dana). `leader`/`area_manager` punya akses app `finance` (ROLE_APP_ACCESS)
// untuk tahap mereka sendiri, TAPI bukan untuk aksi di file ini.
const FINANCE_STAFF_ROLES = ['admin_finance', 'admin', 'owner']

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

export async function processPettyCashFinanceCustomAmount(formData: FormData) {
  try {
    const id = formData.get('id') as string
    const action = formData.get('action') as 'approve' | 'reject'
    const method = (formData.get('method') as DisbursementMethod) || 'transfer'
    const cashLocationId = formData.get('cashLocationId') as string | null
    const proofFile = formData.get('proofFile') as File | null
    const approvedAmountStr = formData.get('approvedAmount') as string | null
    const approvedAmount = approvedAmountStr ? Number(approvedAmountStr) : null
    const approvalNote = formData.get('approvalNote') as string | null

    // Server Action = endpoint POST publik; RPC finance_process_petty_cash
    // (SECURITY DEFINER) tidak cek role sama sekali, jadi gerbang wajib di sini.
    const { userId: validUserId } = await requireRole(FINANCE_STAFF_ROLES)

    const supabase = await getSupabaseClient()

    let proofOfTransferUrl: string | null = null
    if (proofFile && proofFile.size > 0) {
      const ext = proofFile.name.split('.').pop() || 'jpg'
      const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`
      const storagePath = `finance-proofs/${cleanName}`
      
      const buffer = await proofFile.arrayBuffer()
      const { error: upErr } = await supabase.storage
        .from('finance-proofs')
        .upload(storagePath, buffer, {
          contentType: proofFile.type
        })
        
      if (upErr) {
        console.warn('Failed to upload proof:', upErr)
        throw new Error('Gagal mengupload bukti pencairan: ' + upErr.message)
      }
      
      const { data: pubData } = supabase.storage
        .from('finance-proofs')
        .getPublicUrl(storagePath)
        
      proofOfTransferUrl = pubData.publicUrl
    }

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

    // approvedAmount datang dari client — jangan pernah percaya mentah.
    // Boleh menurunkan nominal (acc sebagian), tidak boleh menaikkan di atas
    // yang diajukan, dan tidak boleh negatif/nol.
    if (approvedAmount != null) {
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
        throw new Error('Nominal disetujui tidak valid')
      }
      if (approvedAmount > topup.amount) {
        throw new Error('Nominal disetujui tidak boleh melebihi nominal yang diajukan')
      }
    }

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

export async function forwardPettyCashFinance({ id }: { id: string, userId?: string }) {
  try {
    const { userId: validUserId } = await requireRole(FINANCE_STAFF_ROLES)

    const supabase = await getSupabaseClient()
    const { data: topup, error: fetchError } = await supabase
      .from('petty_cash_topups')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError || !topup) {
      throw new Error(`Top up request not found (${fetchError?.message || ''})`)
    }

    if (topup.status !== 'approved_by_finance') {
      throw new Error(`Status tidak valid untuk diserahkan ke AM (status: ${topup.status})`)
    }

    const { error: rpcError } = await supabase.rpc('finance_forward_funds', {
      p_topup_id: id
    })

    if (rpcError) {
      throw new Error(rpcError.message || 'Gagal meneruskan dana via RPC')
    }
    
    // Rekam siapa yang meneruskan dana — dari sesi terverifikasi, bukan dari client.
    {
      await supabase.from('petty_cash_topups').update({ finance_forwarded_by: validUserId, finance_forwarded_at: new Date().toISOString() }).eq('id', id)
    }

    revalidatePath('/petty-cash')
    return { success: true }
  } catch (err: any) {
    console.error('Error in forwardPettyCashFinance:', err)
    return { success: false, error: err?.message || 'Gagal meneruskan dana' }
  }
}

