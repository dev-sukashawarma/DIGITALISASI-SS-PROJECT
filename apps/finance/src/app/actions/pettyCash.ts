'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { buatLinkUnggah, createSupabaseServerClient, type LinkUnggah, type PermintaanLink } from '@suka/auth'
import { getServiceSupabase } from '@/lib/supabase-service'
import { requireRole } from '@/lib/authz'
import { DisbursementMethod } from '@/lib/types'
import { deskripsiPettyCash } from '@/lib/approval/deskripsiPettyCash'

// Role yang benar-benar boleh memproses tahap Finance (approve/reject/forward
// dana). `leader`/`area_manager` punya akses app `finance` (ROLE_APP_ACCESS)
// untuk tahap mereka sendiri, TAPI bukan untuk aksi di file ini.
const FINANCE_STAFF_ROLES = ['admin_finance', 'admin', 'owner', 'developer']

async function getSupabaseClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

function adalahUrlBuktiPencairan(url: string): boolean {
  const dasar = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  if (!dasar) return false
  return url.startsWith(`${dasar}/storage/v1/object/public/finance-proofs/`) && !url.includes('..')
}

/** Signed upload URL untuk bukti pencairan petty cash (file tidak lewat server aplikasi). */
export async function mintaLinkUnggahBuktiPencairanAction(permintaan: PermintaanLink): Promise<LinkUnggah> {
  try {
    await requireRole(FINANCE_STAFF_ROLES)
    return await buatLinkUnggah({
      supabase: getServiceSupabase(),
      bucket: 'finance-proofs',
      folder: 'finance-proofs',
      permintaan,
    })
  } catch (err: any) {
    console.error('Exception in mintaLinkUnggahBuktiPencairanAction:', err)
    return { ok: false, pesan: err?.message || 'Gagal menyiapkan unggahan bukti' }
  }
}

export async function processPettyCashFinanceCustomAmount(formData: FormData) {
  try {
    const id = formData.get('id') as string
    const action = formData.get('action') as 'approve' | 'reject'
    const method = (formData.get('method') as DisbursementMethod) || 'transfer'
    const cashLocationId = formData.get('cashLocationId') as string | null
    const proofUrlMentah = (formData.get('proofUrl') as string | null)?.trim() || null
    const approvedAmountStr = formData.get('approvedAmount') as string | null
    const approvedAmount = approvedAmountStr ? Number(approvedAmountStr) : null
    const approvalNote = formData.get('approvalNote') as string | null

    // Server Action dapat dipanggil langsung, termasuk sebelum unggah bukti.
    await requireRole(FINANCE_STAFF_ROLES)

    if (action === 'approve') {
      if (!cashLocationId) throw new Error('Pilih sumber dana Rekening Petty Cash')
      if (method !== 'transfer' && method !== 'tunai') throw new Error('Metode pencairan tidak valid')
    }

    const supabase = await getSupabaseClient()

    // Bukti diunggah browser langsung ke Storage (mintaLinkUnggahBuktiPencairanAction);
    // di sini hanya URL-nya. Terima hanya URL publik bucket finance-proofs project ini.
    let proofOfTransferUrl: string | null = null
    if (proofUrlMentah) {
      if (!adalahUrlBuktiPencairan(proofUrlMentah)) throw new Error('Bukti pencairan tidak valid. Unggah ulang buktinya.')
      proofOfTransferUrl = proofUrlMentah
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

    // 1. Panggil RPC khusus yang bisa menangani adjustment amount & description
    // RPC ini dijamin sukses tanpa terhadang RLS UPDATE karena SECURITY DEFINER.
    
    // Approve: catatan/nominal disesuaikan. Reject: alasan tolak ikut tersimpan.
    const newDescription = deskripsiPettyCash({
      deskripsiAwal: topup.description,
      action,
      nominalDiajukan: topup.amount,
      nominalDisetujui: approvedAmount ?? undefined,
      catatan: approvalNote,
    })

    const { error: rpcError } = await supabase.rpc('finance_process_petty_cash_custom', {
      p_topup_id: id,
      p_action: action,
      p_method: method,
      p_cash_location_id: cashLocationId || null,
      p_proof_of_transfer_url: proofOfTransferUrl || null,
      p_final_amount: approvedAmount,
      p_description: newDescription !== topup.description ? newDescription : null
    })

    if (rpcError) {
      console.error('RPC finance_process_petty_cash_custom error:', rpcError)
      throw new Error(rpcError.message || 'Gagal memproses pencairan via RPC')
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

