'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
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

async function getCurrentUserId(supabase: Awaited<ReturnType<typeof getAuthedClient>>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: No active user session found')
  }
  return user.id
}

export type WasteReportData = {
  outlet_id: string;
  bahan_baku_id: string;
  qty: number;
  reason: string;
  photo_url: string;
}

const WASTE_APPROVER_ROLES = ['leader', 'spv', 'kitchen', 'admin', 'owner'] as const

/**
 * Cek role approver waste saja (tanpa scope outlet).
 */
async function requireApproverIdentity() {
  const authedClient = await getAuthedClient()
  const currentUserId = await getCurrentUserId(authedClient)
  const supabase = makeServiceClient()

  const { data: staff, error } = await supabase
    .from('outlet_staff')
    .select('role, status')
    .eq('id', currentUserId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active' || !(WASTE_APPROVER_ROLES as readonly string[]).includes(staff.role)) {
    throw new Error('Forbidden: hanya Leader/SPV/Kitchen/Admin/Owner yang boleh menyetujui atau menolak laporan waste')
  }

  return { currentUserId, authedClient }
}

/**
 * Gerbang approval waste untuk SATU outlet tertentu. Role check saja tidak
 * cukup — leader adalah role multi-outlet-scoped (via staff_outlets), bukan
 * otomatis semua outlet seperti spv/kitchen/admin/owner. Tanpa cek ini,
 * leader outlet A bisa approve/reject laporan waste outlet B.
 */
async function requireWasteApprover(outletId: string): Promise<string> {
  const { currentUserId, authedClient } = await requireApproverIdentity()
  await assertOutletAccessible(authedClient, outletId)
  return currentUserId
}

/**
 * Gerbang untuk fetch daftar/jumlah waste report pending. Sama seperti
 * requireOpnameApproverForList: outletId diisi → dicek scope-nya; kosong →
 * kembalikan set outlet yang boleh dilihat supaya query di-filter (bukan
 * dibiarkan unrestricted lintas semua outlet).
 */
async function requireWasteApproverForList(outletId?: string): Promise<Set<string> | null> {
  const { authedClient } = await requireApproverIdentity()
  const allowed = await getAccessibleOutletIds(authedClient)

  if (outletId) {
    if (!allowed.has(outletId)) {
      throw new Error('Forbidden: outlet di luar scope akses Anda')
    }
    return null
  }

  return allowed
}

export async function submitWasteReport(data: WasteReportData): Promise<void> {
  const authedClient = await getAuthedClient()
  const currentUserId = await getCurrentUserId(authedClient)
  await assertOutletAccessible(authedClient, data.outlet_id)

  const supabase = makeServiceClient()
  const { error } = await supabase
    .from('stok_waste_reports')
    .insert({
      ...data,
      reported_by: currentUserId,
      status: 'PENDING'
    })

  if (error) throw new Error(error.message)
}

export async function approveWasteReport(id: string): Promise<void> {
  const supabase = makeServiceClient()
  const { data: report, error: reportError } = await supabase
    .from('stok_waste_reports')
    .select('outlet_id')
    .eq('id', id)
    .maybeSingle()
  if (reportError) throw new Error(reportError.message)
  if (!report) throw new Error('Laporan waste tidak ditemukan')

  const currentUserId = await requireWasteApprover(report.outlet_id)

  const { error } = await supabase
    .from('stok_waste_reports')
    .update({
      status: 'APPROVED',
      approved_by: currentUserId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('status', 'PENDING') // ensure it's still pending

  if (error) throw new Error(error.message)
}

export async function rejectWasteReport(id: string, reason: string): Promise<void> {
  const supabase = makeServiceClient()
  const { data: report, error: reportError } = await supabase
    .from('stok_waste_reports')
    .select('outlet_id')
    .eq('id', id)
    .maybeSingle()
  if (reportError) throw new Error(reportError.message)
  if (!report) throw new Error('Laporan waste tidak ditemukan')

  const currentUserId = await requireWasteApprover(report.outlet_id)

  const { error } = await supabase
    .from('stok_waste_reports')
    .update({
      status: 'REJECTED',
      rejection_reason: reason,
      approved_by: currentUserId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('status', 'PENDING')

  if (error) throw new Error(error.message)
}

export async function fetchPendingWasteReports(outletId?: string) {
  const scopeToOutletIds = await requireWasteApproverForList(outletId)
  const supabase = makeServiceClient()
  let query = supabase
    .from('stok_waste_reports')
    .select('*, bahan_baku(nama, satuan), outlets(name), reported_by_staff:outlet_staff!reported_by(name)')
    .eq('status', 'PENDING')
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

export async function countPendingWasteReports(outletId?: string) {
  const scopeToOutletIds = await requireWasteApproverForList(outletId)
  const supabase = makeServiceClient()
  let query = supabase
    .from('stok_waste_reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PENDING')

  if (outletId) {
    query = query.eq('outlet_id', outletId)
  } else if (scopeToOutletIds) {
    query = query.in('outlet_id', Array.from(scopeToOutletIds))
  }

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count || 0
}

/**
 * Waste report milik staff yang SEDANG LOGIN — staffId diambil dari sesi,
 * bukan dari parameter client, supaya "My" benar-benar berarti diri sendiri
 * (sebelumnya caller bisa mengoper staffId siapa pun untuk baca riwayat
 * waste orang lain).
 */
export async function fetchMyWasteReports() {
  const authedClient = await getAuthedClient()
  const currentUserId = await getCurrentUserId(authedClient)

  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('stok_waste_reports')
    .select('*, bahan_baku(nama, satuan)')
    .eq('reported_by', currentUserId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return data
}
