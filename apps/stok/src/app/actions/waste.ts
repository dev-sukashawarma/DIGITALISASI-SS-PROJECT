'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { assertOutletAccessible, getAccessibleOutletIds } from '@/lib/stok/outletAccess'

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
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

const WASTE_APPROVER_ROLES = ['area_manager', 'regional_manager', 'admin', 'kitchen', 'developer'] as const

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
    throw new Error('Forbidden: hanya Area Manager, Regional Manager, Admin, Central Kitchen, atau Developer yang boleh menyetujui atau menolak laporan waste')
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

export async function submitWasteReport(data: WasteReportData): Promise<{ success: boolean; error?: string }> {
  try {
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

    if (error) {
      console.error('[submitWasteReport] Supabase insert error:', error.message)
      return { success: false, error: `Gagal menyimpan ke database: ${error.message}` }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[submitWasteReport] Exception:', err)
    const rawMsg = err instanceof Error ? err.message : String(err)
    if (rawMsg.includes('Unauthorized') || rawMsg.includes('session')) {
      return { success: false, error: 'Sesi login Anda telah berakhir. Silakan muat ulang (refresh) halaman atau login kembali.' }
    }
    if (rawMsg.includes('Forbidden')) {
      return { success: false, error: 'Akses ditolak: akun Anda tidak memiliki akses ke outlet ini.' }
    }
    return { success: false, error: rawMsg || 'Terjadi kesalahan saat memproses laporan waste' }
  }
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
    .select('*, bahan_baku(nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan), outlets(name), reported_by_staff:outlet_staff!reported_by(name)')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })

  if (outletId) {
    query = query.eq('outlet_id', outletId)
  } else if (scopeToOutletIds) {
    query = query.in('outlet_id', Array.from(scopeToOutletIds))
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rawReports = data ?? []
  const bahanBakuIds = Array.from(new Set(rawReports.map((r: any) => r.bahan_baku_id).filter(Boolean)))
  const priceMap = new Map<string, number>()

  if (bahanBakuIds.length > 0) {
    const { data: prices } = await supabase
      .from('bahan_baku_harga')
      .select('bahan_baku_id, harga_beli')
      .in('bahan_baku_id', bahanBakuIds)

    for (const p of prices || []) {
      priceMap.set(p.bahan_baku_id, Number(p.harga_beli) || 0)
    }
  }

  return rawReports.map((r: any) => {
    const hargaBeli = priceMap.get(r.bahan_baku_id) || 0
    const qtyNum = Number(r.qty) || 0
    const nilai = Math.round(qtyNum * hargaBeli)
    return {
      ...r,
      harga_beli: hargaBeli,
      nilai_waste: nilai,
    }
  })
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
    .select('*, bahan_baku(nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan)')
    .eq('reported_by', currentUserId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return data
}

export async function getWasteReportDetails(id: string) {
  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('stok_waste_reports')
    .select('photo_url, created_at, updated_at, reported_by_staff:outlet_staff!reported_by(name), approved_by_staff:outlet_staff!approved_by(name)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export interface WasteHistoryFilter {
  outletId?: string
  status?: 'ALL' | 'APPROVED' | 'REJECTED' | 'PENDING'
  from?: string // YYYY-MM-DD
  to?: string   // YYYY-MM-DD
  page?: number // default: 1
  limit?: number // default: 25
}

export interface WasteHistoryResult {
  data: any[]
  totalCount: number
  totalNilai: number
  page: number
  limit: number
  totalPages: number
}

export async function fetchWasteHistory(filters: WasteHistoryFilter = {}): Promise<WasteHistoryResult> {
  const authedClient = await getAuthedClient()
  const currentUserId = await getCurrentUserId(authedClient)
  const supabase = makeServiceClient()

  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('role, outlet_id, status')
    .eq('id', currentUserId)
    .maybeSingle()

  if (staffError || !staff || staff.status !== 'active') {
    throw new Error('Unauthorized: Akun staf tidak aktif atau tidak ditemukan')
  }

  const isApprover = (WASTE_APPROVER_ROLES as readonly string[]).includes(staff.role)
  const allowedOutletIds = await getAccessibleOutletIds(authedClient)

  let query = supabase
    .from('stok_waste_reports')
    .select(
      '*, bahan_baku(nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan), outlets(name), reported_by_staff:outlet_staff!reported_by(name), approved_by_staff:outlet_staff!approved_by(name)',
      { count: 'exact' }
    )

  let summaryQuery = supabase
    .from('stok_waste_reports')
    .select('bahan_baku_id, qty')

  if (!isApprover) {
    // Regular staff: strictly scoped to staff.outlet_id
    if (!staff.outlet_id) {
      throw new Error('Staff belum ditugaskan ke outlet mana pun')
    }
    query = query.eq('outlet_id', staff.outlet_id)
    summaryQuery = summaryQuery.eq('outlet_id', staff.outlet_id)
  } else if (filters.outletId) {
    if (allowedOutletIds.size > 0 && !allowedOutletIds.has(filters.outletId)) {
      throw new Error('Forbidden: outlet di luar cakupan akses Anda')
    }
    query = query.eq('outlet_id', filters.outletId)
    summaryQuery = summaryQuery.eq('outlet_id', filters.outletId)
  } else if (allowedOutletIds.size > 0) {
    query = query.in('outlet_id', Array.from(allowedOutletIds))
    summaryQuery = summaryQuery.in('outlet_id', Array.from(allowedOutletIds))
  }

  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status)
    summaryQuery = summaryQuery.eq('status', filters.status)
  }

  if (filters.from) {
    query = query.gte('created_at', `${filters.from}T00:00:00`)
    summaryQuery = summaryQuery.gte('created_at', `${filters.from}T00:00:00`)
  }
  if (filters.to) {
    query = query.lte('created_at', `${filters.to}T23:59:59.999Z`)
    summaryQuery = summaryQuery.lte('created_at', `${filters.to}T23:59:59.999Z`)
  }

  const page = Math.max(1, filters.page || 1)
  const limit = Math.max(1, Math.min(100, filters.limit || 25))
  const fromIdx = (page - 1) * limit
  const toIdx = page * limit - 1

  query = query.order('created_at', { ascending: false }).range(fromIdx, toIdx)

  const [{ data, count, error }, { data: summaryRows }] = await Promise.all([
    query,
    summaryQuery,
  ])

  if (error) throw new Error(error.message)

  const rawReports = data ?? []
  const allSummary = summaryRows ?? []

  // Fetch prices for all bahan_baku in page & summary
  const allBahanBakuIds = Array.from(
    new Set([
      ...rawReports.map((r: any) => r.bahan_baku_id),
      ...allSummary.map((s: any) => s.bahan_baku_id),
    ].filter(Boolean))
  )

  const priceMap = new Map<string, number>()
  if (allBahanBakuIds.length > 0) {
    const { data: prices } = await supabase
      .from('bahan_baku_harga')
      .select('bahan_baku_id, harga_beli')
      .in('bahan_baku_id', allBahanBakuIds)

    for (const p of prices || []) {
      priceMap.set(p.bahan_baku_id, Number(p.harga_beli) || 0)
    }
  }

  let totalNilai = 0
  for (const s of allSummary) {
    const price = priceMap.get(s.bahan_baku_id) || 0
    totalNilai += Math.round((Number(s.qty) || 0) * price)
  }

  const formattedData = rawReports.map((r: any) => {
    const hargaBeli = priceMap.get(r.bahan_baku_id) || 0
    const qtyNum = Number(r.qty) || 0
    const nilai = Math.round(qtyNum * hargaBeli)
    return {
      ...r,
      harga_beli: hargaBeli,
      nilai_waste: nilai,
    }
  })

  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / limit) || 1

  return {
    data: formattedData,
    totalCount,
    totalNilai,
    page,
    limit,
    totalPages,
  }
}

export async function getAccessibleOutletsForWaste(): Promise<{ id: string; name: string }[]> {
  const authedClient = await getAuthedClient()
  const allowedOutletIds = await getAccessibleOutletIds(authedClient)
  const supabase = makeServiceClient()

  let query = supabase.from('outlets').select('id, name').eq('is_active', true).order('name')
  if (allowedOutletIds.size > 0) {
    query = query.in('id', Array.from(allowedOutletIds))
  }
  const { data, error } = await query
  if (error) return []
  return data ?? []
}
