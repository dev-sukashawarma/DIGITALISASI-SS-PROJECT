'use server'

import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type PendingWasteItem = {
  id: string
  outlet_id: string
  outlet_name: string
  bahan_baku_id: string
  bahan_nama: string
  satuan: string
  qty: number
  harga_beli: number
  nilai_waste: number
  reason: string
  photo_url: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejection_reason: string | null
  reporter_name: string
  created_at: string
}

export type WasteHistoryItem = {
  id: string
  outlet_id: string
  outlet_name: string
  bahan_baku_id: string
  bahan_nama: string
  satuan: string
  qty: number
  harga_beli: number
  nilai_waste: number
  reason: string
  photo_url: string | null
  status: 'APPROVED' | 'REJECTED'
  rejection_reason: string | null
  reporter_name: string
  approver_name: string | null
  created_at: string
  updated_at: string
}

export type WasteSummaryData = {
  totalNilaiWaste: number
  totalIncidents: number
  topItems: { nama: string; qty: number; satuan: string; nilai: number }[]
  pendingCount: number
}

export type OutletOption = {
  id: string
  name: string
}

export async function getStaffAndAccessibleOutlets() {
  const headersList = await headers()
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER))

  if (!staff) {
    return { staff: null, isAllOutlets: false, accessibleOutletIds: [] }
  }

  const role = staff.role
  const supabaseAdmin = getSupabaseAdmin()

  // RM, Admin, Owner, Dev can access all outlets
  if (role === 'regional_manager' || role === 'admin' || role === 'owner' || role === 'developer') {
    return { staff, isAllOutlets: true, accessibleOutletIds: [] }
  }

  // Area Manager or Leader: scope to staff_outlets
  if (role === 'area_manager' || role === 'leader') {
    const { data: so } = await supabaseAdmin
      .from('staff_outlets')
      .select('outlet_id')
      .eq('staff_id', staff.id)

    const ids = (so || []).map((x: any) => x.outlet_id)
    return { staff, isAllOutlets: false, accessibleOutletIds: ids }
  }

  // Single outlet fallback
  if (staff.outlet_id) {
    return { staff, isAllOutlets: false, accessibleOutletIds: [staff.outlet_id] }
  }

  return { staff, isAllOutlets: false, accessibleOutletIds: [] }
}

export async function getAccessibleOutletsForWaste(): Promise<{ success: boolean; data: OutletOption[]; error?: string }> {
  try {
    const { staff, isAllOutlets, accessibleOutletIds } = await getStaffAndAccessibleOutlets()
    if (!staff) return { success: false, data: [], error: 'Belum login' }

    const supabaseAdmin = getSupabaseAdmin()
    let q = supabaseAdmin.from('outlets').select('id, name').eq('is_active', true).order('name')

    if (!isAllOutlets) {
      if (accessibleOutletIds.length === 0) {
        return { success: true, data: [] }
      }
      q = q.in('id', accessibleOutletIds)
    }

    const { data, error } = await q
    if (error) throw error

    return { success: true, data: data || [] }
  } catch (err: any) {
    console.error('getAccessibleOutletsForWaste error:', err)
    return { success: false, data: [], error: err.message }
  }
}

/**
 * Fetch pending waste reports for AM (scoped to assigned outlets) or RM (all outlets)
 */
export async function getPendingWasteReports(filterOutletId?: string): Promise<{ success: boolean; data: PendingWasteItem[]; error?: string }> {
  try {
    const { staff, isAllOutlets, accessibleOutletIds } = await getStaffAndAccessibleOutlets()
    if (!staff) return { success: false, data: [], error: 'Belum login' }

    const supabaseAdmin = getSupabaseAdmin()

    let query = supabaseAdmin
      .from('stok_waste_reports')
      .select(`
        id,
        outlet_id,
        bahan_baku_id,
        qty,
        reason,
        photo_url,
        status,
        rejection_reason,
        created_at,
        outlets (
          id,
          name
        ),
        bahan_baku (
          id,
          nama,
          satuan
        ),
        reporter:outlet_staff!reported_by (
          id,
          name
        )
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })

    if (filterOutletId && filterOutletId !== 'all') {
      if (!isAllOutlets && !accessibleOutletIds.includes(filterOutletId)) {
        return { success: true, data: [] }
      }
      query = query.eq('outlet_id', filterOutletId)
    } else if (!isAllOutlets) {
      if (accessibleOutletIds.length === 0) {
        return { success: true, data: [] }
      }
      query = query.in('outlet_id', accessibleOutletIds)
    }

    const { data: rawReports, error: reqErr } = await query
    if (reqErr) throw reqErr

    if (!rawReports || rawReports.length === 0) {
      return { success: true, data: [] }
    }

    // Get bahan baku prices
    const bahanBakuIds = Array.from(new Set(rawReports.map((r: any) => r.bahan_baku_id)))
    const { data: prices } = await supabaseAdmin
      .from('bahan_baku_harga')
      .select('bahan_baku_id, harga_beli')
      .in('bahan_baku_id', bahanBakuIds)

    const priceMap = new Map<string, number>()
    for (const p of prices || []) {
      priceMap.set(p.bahan_baku_id, Number(p.harga_beli) || 0)
    }

    const formattedData: PendingWasteItem[] = rawReports.map((r: any) => {
      const hargaBeli = priceMap.get(r.bahan_baku_id) || 0
      const qtyNum = Number(r.qty) || 0
      const nilai = Math.round(qtyNum * hargaBeli)

      return {
        id: r.id,
        outlet_id: r.outlet_id,
        outlet_name: r.outlets?.name || 'Unknown Outlet',
        bahan_baku_id: r.bahan_baku_id,
        bahan_nama: r.bahan_baku?.nama || 'Bahan Tidak Diketahui',
        satuan: r.bahan_baku?.satuan || 'Pcs',
        qty: qtyNum,
        harga_beli: hargaBeli,
        nilai_waste: nilai,
        reason: r.reason,
        photo_url: r.photo_url,
        status: r.status,
        rejection_reason: r.rejection_reason,
        reporter_name: r.reporter?.name || 'Kru Outlet',
        created_at: r.created_at,
      }
    })

    return { success: true, data: formattedData }
  } catch (err: any) {
    console.error('getPendingWasteReports error:', err)
    return { success: false, data: [], error: err.message }
  }
}

/**
 * Fetch waste history (APPROVED / REJECTED) with pagination, date filter, outlet filter
 */
export async function getWasteHistory(params: {
  from: string
  to: string
  outletId?: string
  status?: string // 'all', 'APPROVED', 'REJECTED'
  page?: number
  limit?: number
}): Promise<{
  success: boolean
  data: WasteHistoryItem[]
  totalCount: number
  page: number
  totalPages: number
  error?: string
}> {
  try {
    const { staff, isAllOutlets, accessibleOutletIds } = await getStaffAndAccessibleOutlets()
    if (!staff) return { success: false, data: [], totalCount: 0, page: 1, totalPages: 1, error: 'Belum login' }

    const supabaseAdmin = getSupabaseAdmin()
    const page = Math.max(1, params.page || 1)
    const limit = Math.max(1, Math.min(100, params.limit || 20))
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('stok_waste_reports')
      .select(
        `
        id,
        outlet_id,
        bahan_baku_id,
        qty,
        reason,
        photo_url,
        status,
        rejection_reason,
        created_at,
        updated_at,
        outlets (
          id,
          name
        ),
        bahan_baku (
          id,
          nama,
          satuan
        ),
        reporter:outlet_staff!reported_by (
          id,
          name
        ),
        approver:outlet_staff!approved_by (
          id,
          name
        )
      `,
        { count: 'exact' }
      )
      .gte('created_at', `${params.from}T00:00:00+07:00`)
      .lte('created_at', `${params.to}T23:59:59.999+07:00`)

    // Status filter
    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status)
    } else {
      query = query.in('status', ['APPROVED', 'REJECTED'])
    }

    // Outlet filter
    if (params.outletId && params.outletId !== 'all') {
      if (!isAllOutlets && !accessibleOutletIds.includes(params.outletId)) {
        return { success: true, data: [], totalCount: 0, page, totalPages: 0 }
      }
      query = query.eq('outlet_id', params.outletId)
    } else if (!isAllOutlets) {
      if (accessibleOutletIds.length === 0) {
        return { success: true, data: [], totalCount: 0, page, totalPages: 0 }
      }
      query = query.in('outlet_id', accessibleOutletIds)
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: rawReports, count, error: reqErr } = await query
    if (reqErr) throw reqErr

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit) || 1

    if (!rawReports || rawReports.length === 0) {
      return { success: true, data: [], totalCount: 0, page, totalPages }
    }

    // Fetch prices for bahan_baku
    const bahanBakuIds = Array.from(new Set(rawReports.map((r: any) => r.bahan_baku_id)))
    const { data: prices } = await supabaseAdmin
      .from('bahan_baku_harga')
      .select('bahan_baku_id, harga_beli')
      .in('bahan_baku_id', bahanBakuIds)

    const priceMap = new Map<string, number>()
    for (const p of prices || []) {
      priceMap.set(p.bahan_baku_id, Number(p.harga_beli) || 0)
    }

    const formattedData: WasteHistoryItem[] = rawReports.map((r: any) => {
      const hargaBeli = priceMap.get(r.bahan_baku_id) || 0
      const qtyNum = Number(r.qty) || 0
      const nilai = Math.round(qtyNum * hargaBeli)

      return {
        id: r.id,
        outlet_id: r.outlet_id,
        outlet_name: r.outlets?.name || 'Unknown Outlet',
        bahan_baku_id: r.bahan_baku_id,
        bahan_nama: r.bahan_baku?.nama || 'Bahan Tidak Diketahui',
        satuan: r.bahan_baku?.satuan || 'Pcs',
        qty: qtyNum,
        harga_beli: hargaBeli,
        nilai_waste: nilai,
        reason: r.reason,
        photo_url: r.photo_url,
        status: r.status,
        rejection_reason: r.rejection_reason,
        reporter_name: r.reporter?.name || 'Kru Outlet',
        approver_name: r.approver?.name || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }
    })

    return { success: true, data: formattedData, totalCount, page, totalPages }
  } catch (err: any) {
    console.error('getWasteHistory error:', err)
    return { success: false, data: [], totalCount: 0, page: 1, totalPages: 1, error: err.message }
  }
}

/**
 * Agregasi KPI Waste untuk periode dan outlet yang dipilih
 */
export async function getWasteSummary(params: {
  from: string
  to: string
  outletId?: string
}): Promise<{ success: boolean; data: WasteSummaryData; error?: string }> {
  try {
    const { staff, isAllOutlets, accessibleOutletIds } = await getStaffAndAccessibleOutlets()
    if (!staff) {
      return {
        success: false,
        data: { totalNilaiWaste: 0, totalIncidents: 0, topItems: [], pendingCount: 0 },
        error: 'Belum login',
      }
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Pending count
    let pendingQuery = supabaseAdmin
      .from('stok_waste_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING')

    // 2. Approved waste for the period
    let approvedQuery = supabaseAdmin
      .from('stok_waste_reports')
      .select(`
        id,
        outlet_id,
        bahan_baku_id,
        qty,
        bahan_baku (
          nama,
          satuan
        )
      `)
      .eq('status', 'APPROVED')
      .gte('created_at', `${params.from}T00:00:00+07:00`)
      .lte('created_at', `${params.to}T23:59:59.999+07:00`)

    if (params.outletId && params.outletId !== 'all') {
      if (!isAllOutlets && !accessibleOutletIds.includes(params.outletId)) {
        return {
          success: true,
          data: { totalNilaiWaste: 0, totalIncidents: 0, topItems: [], pendingCount: 0 },
        }
      }
      pendingQuery = pendingQuery.eq('outlet_id', params.outletId)
      approvedQuery = approvedQuery.eq('outlet_id', params.outletId)
    } else if (!isAllOutlets) {
      if (accessibleOutletIds.length === 0) {
        return {
          success: true,
          data: { totalNilaiWaste: 0, totalIncidents: 0, topItems: [], pendingCount: 0 },
        }
      }
      pendingQuery = pendingQuery.in('outlet_id', accessibleOutletIds)
      approvedQuery = approvedQuery.in('outlet_id', accessibleOutletIds)
    }

    const [{ count: pendingCount }, { data: approvedList, error: appErr }] = await Promise.all([
      pendingQuery,
      approvedQuery,
    ])

    if (appErr) throw appErr

    const approvedItems = approvedList || []
    const totalIncidents = approvedItems.length

    if (totalIncidents === 0) {
      return {
        success: true,
        data: {
          totalNilaiWaste: 0,
          totalIncidents: 0,
          topItems: [],
          pendingCount: pendingCount || 0,
        },
      }
    }

    // Fetch prices for bahan_baku in approved list
    const bahanBakuIds = Array.from(new Set(approvedItems.map((r: any) => r.bahan_baku_id)))
    const { data: prices } = await supabaseAdmin
      .from('bahan_baku_harga')
      .select('bahan_baku_id, harga_beli')
      .in('bahan_baku_id', bahanBakuIds)

    const priceMap = new Map<string, number>()
    for (const p of prices || []) {
      priceMap.set(p.bahan_baku_id, Number(p.harga_beli) || 0)
    }

    let totalNilai = 0
    const aggMap = new Map<string, { nama: string; qty: number; satuan: string; nilai: number }>()

    for (const item of approvedItems as any[]) {
      const hargaBeli = priceMap.get(item.bahan_baku_id) || 0
      const qtyNum = Number(item.qty) || 0
      const subtotal = Math.round(qtyNum * hargaBeli)
      totalNilai += subtotal

      const nama = item.bahan_baku?.nama || 'Unknown'
      const satuan = item.bahan_baku?.satuan || 'Pcs'
      const existing = aggMap.get(item.bahan_baku_id)
      if (existing) {
        existing.qty += qtyNum
        existing.nilai += subtotal
      } else {
        aggMap.set(item.bahan_baku_id, {
          nama,
          qty: qtyNum,
          satuan,
          nilai: subtotal,
        })
      }
    }

    const topItems = Array.from(aggMap.values())
      .sort((a, b) => b.nilai - a.nilai)
      .slice(0, 5)

    return {
      success: true,
      data: {
        totalNilaiWaste: totalNilai,
        totalIncidents,
        topItems,
        pendingCount: pendingCount || 0,
      },
    }
  } catch (err: any) {
    console.error('getWasteSummary error:', err)
    return {
      success: false,
      data: { totalNilaiWaste: 0, totalIncidents: 0, topItems: [], pendingCount: 0 },
      error: err.message,
    }
  }
}

/**
 * Process approve or reject on a waste report
 */
export async function processWasteApproval(
  id: string,
  action: 'approve' | 'reject',
  rejectionReason?: string
): Promise<{ success: boolean; newStatus?: string; error?: string }> {
  try {
    const { staff, isAllOutlets, accessibleOutletIds } = await getStaffAndAccessibleOutlets()
    if (!staff) return { success: false, error: 'Unauthorized: Belum login' }

    // Wewenang role
    const validRoles = ['area_manager', 'regional_manager', 'admin', 'owner', 'developer']
    if (!validRoles.includes(staff.role)) {
      return { success: false, error: 'Akses ditolak: Hanya Manager atau Admin yang boleh memproses waste' }
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Ambil report saat ini
    const { data: report, error: repErr } = await supabaseAdmin
      .from('stok_waste_reports')
      .select('id, outlet_id, status, reported_by')
      .eq('id', id)
      .maybeSingle()

    if (repErr || !report) {
      return { success: false, error: 'Laporan waste tidak ditemukan' }
    }

    if (report.status !== 'PENDING') {
      return { success: false, error: `Laporan sudah diproses sebelumnya (Status: ${report.status})` }
    }

    // 2. Cek otorisasi outlet jika AM
    if (!isAllOutlets && !accessibleOutletIds.includes(report.outlet_id)) {
      return { success: false, error: 'Akses ditolak: Outlet di luar wilayah kewenangan Anda' }
    }

    // 3. Pencegahan self-approval
    if (report.reported_by === staff.id) {
      return { success: false, error: 'Anda tidak dapat menyetujui laporan yang Anda buat sendiri' }
    }

    // 4. Validasi alasan penolakan
    if (action === 'reject') {
      if (!rejectionReason || rejectionReason.trim().length < 3) {
        return { success: false, error: 'Alasan penolakan wajib diisi (minimal 3 karakter)' }
      }
    }

    const targetStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    const updatePayload: any = {
      status: targetStatus,
      approved_by: staff.id,
      updated_at: new Date().toISOString(),
    }

    if (action === 'reject') {
      updatePayload.rejection_reason = rejectionReason?.trim()
    }

    // 5. Update atomic dengan mengunci status PENDING
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('stok_waste_reports')
      .update(updatePayload)
      .eq('id', id)
      .eq('status', 'PENDING')
      .select('id, status')
      .maybeSingle()

    if (updateErr) throw updateErr
    if (!updated) {
      return { success: false, error: 'Gagal memproses: Laporan mungkin sudah diproses oleh manajer lain' }
    }

    return { success: true, newStatus: targetStatus }
  } catch (err: any) {
    console.error('processWasteApproval error:', err)
    return { success: false, error: err.message }
  }
}
