'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { canApproveOpname } from '@/lib/stok/approver'
import { assertOutletAccessible, getAccessibleOutletIds } from '@/lib/stok/outletAccess'

function makeServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getAuthedClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
}

async function getCurrentStaffId(supabase: Awaited<ReturnType<typeof getAuthedClient>>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: No active user session found')
  }
  // outlet_staff.id = auth user id (sesuai pattern yang dipakai di waste.ts)
  return user.id
}

/**
 * Cek role approval opname saja (tanpa scope outlet) — dipakai untuk gerbang
 * identitas sebelum tahu outlet_id mana yang relevan.
 */
async function requireApproverIdentity() {
  const authedClient = await getAuthedClient()
  const staffId = await getCurrentStaffId(authedClient)

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status')
    .eq('id', staffId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active' || !canApproveOpname(staff.role)) {
    throw new Error('Forbidden: hanya leader/SPV/kitchen yang boleh memproses approval opname')
  }

  return { staffId, authedClient }
}

/**
 * Gerbang otorisasi server-side untuk aksi approval opname pada SATU outlet
 * tertentu (approve/reject).
 *
 * WAJIB dipanggil sebelum menyentuh service-role client: RPC `approve_opname`
 * / `reject_opname` adalah SECURITY DEFINER dan TIDAK memeriksa role maupun
 * outlet pemanggil (hanya cek status opname), sedangkan `makeServiceClient()`
 * mem-bypass RLS. Server Action = endpoint POST yang bisa dipanggil siapa pun
 * yang punya sesi, jadi guard di UI/halaman tidak melindungi apa pun.
 *
 * Role check saja TIDAK CUKUP: leader/korlap adalah role multi-outlet-scoped
 * (via staff_outlets), bukan otomatis semua outlet seperti spv/kitchen/admin/
 * owner — tanpa cek ini, leader outlet A bisa approve opname outlet B yang
 * bukan tanggung jawabnya. assertOutletAccessible() delegasikan scope ke
 * accessible_outlet_ids() (sumber kebenaran yang sama dipakai RLS).
 */
async function requireOpnameApprover(outletId: string): Promise<string> {
  const { staffId, authedClient } = await requireApproverIdentity()
  await assertOutletAccessible(authedClient, outletId)
  return staffId
}

/**
 * Gerbang otorisasi untuk fetch daftar/jumlah opname pending. `outletId`
 * opsional: kalau diisi, dicek scope-nya; kalau kosong, dikembalikan set
 * outlet yang boleh dilihat supaya query di-filter (bukan dibiarkan
 * unrestricted — leader tanpa outletId tidak boleh melihat SEMUA outlet).
 */
async function requireOpnameApproverForList(outletId?: string): Promise<Set<string> | null> {
  const { authedClient } = await requireApproverIdentity()
  const allowed = await getAccessibleOutletIds(authedClient)

  if (outletId) {
    if (!allowed.has(outletId)) {
      throw new Error('Forbidden: outlet di luar scope akses Anda')
    }
    return null // caller sudah filter via .eq('outlet_id', outletId)
  }

  return allowed
}

/**
 * Leader: setujui opname pending.
 * Memanggil RPC approve_opname yang otomatis finalize.
 */
export async function approveOpname(opnameId: string): Promise<void> {
  const supabase = makeServiceClient()
  const { data: opname, error: opnameError } = await supabase
    .from('opname')
    .select('outlet_id')
    .eq('id', opnameId)
    .maybeSingle()
  if (opnameError) throw new Error(opnameError.message)
  if (!opname) throw new Error('Opname tidak ditemukan')

  const staffId = await requireOpnameApprover(opname.outlet_id)

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
  const supabase = makeServiceClient()
  const { data: opname, error: opnameError } = await supabase
    .from('opname')
    .select('outlet_id')
    .eq('id', opnameId)
    .maybeSingle()
  if (opnameError) throw new Error(opnameError.message)
  if (!opname) throw new Error('Opname tidak ditemukan')

  const staffId = await requireOpnameApprover(opname.outlet_id)

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
  const scopeToOutletIds = await requireOpnameApproverForList(outletId)
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
  } else if (scopeToOutletIds) {
    query = query.in('outlet_id', Array.from(scopeToOutletIds))
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

/**
 * Upsert item-item opname ke tabel opname_item.
 *
 * Menggunakan service-role client karena RLS pada tabel opname_item tidak
 * memiliki policy INSERT/UPDATE untuk crew biasa.
 *
 * Return { error } alih-alih throw: di Next.js production, Server Action
 * yang throw Error menghasilkan pesan generic "An error occurred in the
 * Server Components render" yang tidak berguna. Dengan return, client
 * menerima pesan asli.
 */
export async function upsertOpnameItems(
  items: Array<{
    opname_id: string
    bahan_baku_id: string
    qty_fisik: number
    qty_system: number
    selisih: number
    flagged: boolean
    catatan?: string | null
  }>
): Promise<{ error: string | null }> {
  try {
    if (!items.length) return { error: null }

    // Verifikasi user terautentikasi
    const authedClient = await getAuthedClient()
    const staffId = await getCurrentStaffId(authedClient)

    const opnameId = items[0].opname_id
    const serviceClient = makeServiceClient()

    // Verifikasi opname ada dan dibuat oleh staff yang sedang login
    const { data: opname, error: opnameErr } = await serviceClient
      .from('opname')
      .select('outlet_id, created_by, status')
      .eq('id', opnameId)
      .maybeSingle()

    if (opnameErr) return { error: `DB error: ${opnameErr.message}` }
    if (!opname) return { error: 'Opname tidak ditemukan' }

    // Guard: hanya pembuat opname yang boleh upsert item, dan status harus editable
    const isOwner = opname.created_by === staffId
    const isEditable = ['draft', 'pending_approval'].includes(opname.status)
    if (!isOwner || !isEditable) {
      return { error: `Forbidden: Anda (${staffId}) bukan pembuat opname ini (${opname.created_by}), status: ${opname.status}` }
    }

    const { error } = await serviceClient
      .from('opname_item')
      .upsert(items, { onConflict: 'opname_id,bahan_baku_id' })

    if (error) return { error: `Upsert gagal: ${error.message}` }
    return { error: null }
  } catch (e: any) {
    return { error: `Server error: ${e?.message ?? String(e)}` }
  }
}

/**
 * Hitung jumlah opname pending — untuk badge notifikasi di nav.
 */
export async function countPendingOpnameApprovals(outletId?: string): Promise<number> {
  const scopeToOutletIds = await requireOpnameApproverForList(outletId)
  const supabase = makeServiceClient()

  let query = supabase
    .from('opname')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_approval')

  if (outletId) {
    query = query.eq('outlet_id', outletId)
  } else if (scopeToOutletIds) {
    query = query.in('outlet_id', Array.from(scopeToOutletIds))
  }

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count || 0
}
