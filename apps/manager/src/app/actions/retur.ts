'use server'

import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { createClient } from '@supabase/supabase-js'
import { getStaffAndAccessibleOutlets } from './waste'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type ReturApprovalItem = {
  id: string
  nomor_retur: string
  outlet_id: string
  outlet_name: string
  status: string
  created_at: string
  catatan?: string | null
  created_by_name: string
  created_by_role: string
  items: Array<{
    id: string
    bahan_baku_id: string
    bahan_nama: string
    satuan: string
    qty_klaim: number
    foto_fisik_url: string
    foto_timbangan_url?: string | null
    alasan: string
    catatan?: string | null
    faktor_tampilan?: number | null
    satuan_kecil?: string | null
  }>
}

export async function getPendingReturRequests(): Promise<{
  success: boolean
  data: ReturApprovalItem[]
  error?: string
}> {
  try {
    const { staff, isAllOutlets, accessibleOutletIds } = await getStaffAndAccessibleOutlets()
    if (!staff) return { success: false, data: [], error: 'Belum login' }

    const supabaseAdmin = getSupabaseAdmin()

    let query = supabaseAdmin
      .from('retur_stok')
      .select(`
        id,
        nomor_retur,
        outlet_id,
        status,
        created_at,
        catatan_manager,
        outlets (
          id,
          name
        ),
        created_by_staff:outlet_staff!created_by (
          id,
          name,
          role
        ),
        items:retur_stok_item (
          id,
          bahan_baku_id,
          qty_klaim,
          foto_fisik_url,
          foto_timbangan_url,
          alasan,
          catatan,
          bahan_baku:bahan_baku_id (
            id,
            nama,
            satuan,
            faktor_tampilan,
            satuan_kecil,
            faktor_tengah,
            satuan_tengah
          )
        )
      `)
      .eq('status', 'diajukan')
      .order('created_at', { ascending: false })

    if (!isAllOutlets) {
      if (accessibleOutletIds.length === 0) {
        return { success: true, data: [] }
      }
      query = query.in('outlet_id', accessibleOutletIds)
    }

    const { data, error } = await query
    if (error) throw error

    const formatted: ReturApprovalItem[] = (data || []).map((r: any) => ({
      id: r.id,
      nomor_retur: r.nomor_retur,
      outlet_id: r.outlet_id,
      outlet_name: r.outlets?.name || 'Unknown Outlet',
      status: r.status,
      created_at: r.created_at,
      catatan: r.catatan_manager,
      created_by_name: r.created_by_staff?.name || 'Staff Outlet',
      created_by_role: r.created_by_staff?.role || 'staff',
      items: (r.items || []).map((it: any) => ({
        id: it.id,
        bahan_baku_id: it.bahan_baku_id,
        bahan_nama: it.bahan_baku?.nama || 'Bahan Tidak Diketahui',
        satuan: it.bahan_baku?.satuan || 'Pcs',
        qty_klaim: Number(it.qty_klaim) || 0,
        foto_fisik_url: it.foto_fisik_url,
        foto_timbangan_url: it.foto_timbangan_url,
        alasan: it.alasan,
        catatan: it.catatan,
        faktor_tampilan: it.bahan_baku?.faktor_tampilan,
        satuan_kecil: it.bahan_baku?.satuan_kecil,
      })),
    }))

    return { success: true, data: formatted }
  } catch (err: any) {
    console.error('getPendingReturRequests error:', err)
    return { success: false, data: [], error: err.message }
  }
}

export async function processReturApproval(
  returId: string,
  approve: boolean,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { staff, isAllOutlets, accessibleOutletIds } = await getStaffAndAccessibleOutlets()
    if (!staff) return { success: false, error: 'Unauthorized: Belum login' }

    const validRoles = ['area_manager', 'regional_manager', 'admin', 'owner', 'developer', 'spv']
    if (!validRoles.includes(staff.role)) {
      return { success: false, error: 'Hanya Manager yang dapat menyetujui atau menolak retur' }
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Cek retur dan outlet scope
    const { data: retur, error: rErr } = await supabaseAdmin
      .from('retur_stok')
      .select('id, outlet_id, status')
      .eq('id', returId)
      .maybeSingle()

    if (rErr || !retur) {
      return { success: false, error: 'Tiket retur tidak ditemukan' }
    }

    if (!isAllOutlets && !accessibleOutletIds.includes(retur.outlet_id)) {
      return { success: false, error: 'Forbidden: Outlet di luar cakupan wilayah Anda' }
    }

    const { data, error } = await supabaseAdmin.rpc('approve_retur_by_manager', {
      p_retur_id: returId,
      p_approve: approve,
      p_catatan: note || null,
      p_manager_id: staff.id,
    })

    if (error) {
      console.error('approve_retur_by_manager error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('processReturApproval error:', err)
    return { success: false, error: err.message }
  }
}
