'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { canApproveOpname } from '@/lib/stok/approver'

function makeServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getCurrentStaffId(): Promise<string> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: No active user session found')
  }
  // outlet_staff.id = auth user id (sesuai pattern yang dipakai di waste.ts)
  return user.id
}

/**
 * Gerbang otorisasi server-side untuk aksi approval opname.
 *
 * WAJIB dipanggil sebelum menyentuh service-role client: RPC `approve_opname`
 * / `reject_opname` adalah SECURITY DEFINER dan TIDAK memeriksa role pemanggil
 * (hanya cek status opname), sedangkan `makeServiceClient()` mem-bypass RLS.
 * Server Action = endpoint POST yang bisa dipanggil siapa pun yang punya sesi,
 * jadi guard di UI/halaman tidak melindungi apa pun.
 */
async function requireOpnameApprover(): Promise<string> {
  const staffId = await getCurrentStaffId()

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status')
    .eq('id', staffId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active' || !canApproveOpname(staff.role)) {
    throw new Error('Forbidden: hanya leader/SPV/kitchen yang boleh memproses approval opname')
  }

  return staffId
}

/**
 * Leader: setujui opname pending.
 * Memanggil RPC approve_opname yang otomatis finalize.
 */
export async function approveOpname(opnameId: string): Promise<void> {
  const staffId = await requireOpnameApprover()
  const supabase = makeServiceClient()

  const { error } = await supabase.rpc('approve_opname', {
    p_opname_id: opnameId,
    p_approved_by: staffId,
  })

  if (error) throw new Error(error.message)
}

/**
 * Leader: tolak opname pending dengan alasan.
 * Status menjadi 'rejected', crew harus input ulang.
 */
export async function rejectOpname(opnameId: string, reason: string): Promise<void> {
  const staffId = await requireOpnameApprover()
  const supabase = makeServiceClient()

  const { error } = await supabase.rpc('reject_opname', {
    p_opname_id: opnameId,
    p_rejected_by: staffId,
    p_reason: reason,
  })

  if (error) throw new Error(error.message)
}

/**
 * Ambil semua opname berstatus pending_approval.
 * Opsional filter per outlet (untuk leader yang handle 1 outlet).
 */
export async function fetchPendingOpnameApprovals(outletId?: string) {
  await requireOpnameApprover()
  const supabase = makeServiceClient()

  let query = supabase
    .from('opname')
    .select(`
      *,
      outlet_staff!opname_created_by_fkey(name),
      opname_item(qty_fisik, qty_system, selisih, flagged, bahan_baku_id)
    `)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false })

  if (outletId) {
    query = query.eq('outlet_id', outletId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

/**
 * Hitung jumlah opname pending — untuk badge notifikasi di nav.
 */
export async function countPendingOpnameApprovals(outletId?: string): Promise<number> {
  await requireOpnameApprover()
  const supabase = makeServiceClient()

  let query = supabase
    .from('opname')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_approval')

  if (outletId) {
    query = query.eq('outlet_id', outletId)
  }

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count || 0
}
