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

export type BypassRequestItem = {
  id: string
  outlet_id: string
  outlet_name: string
  requested_by_name: string
  reason: string
  status: string
  created_at: string
}

export async function getBypassRequests() {
  try {
    const headersList = await headers()
    const staff = parseStaffHeader(headersList.get(STAFF_HEADER))

    if (!staff) {
      return { success: false, data: [], error: 'Belum login' }
    }

    const role = staff.role
    const supabaseAdmin = getSupabaseAdmin()
    let outletIds: string[] = []

    if (role === 'area_manager' || role === 'leader') {
      const { data: staffOutlets, error: soErr } = await supabaseAdmin
        .from('staff_outlets')
        .select('outlet_id')
        .eq('staff_id', staff.id)

      if (!soErr && staffOutlets) {
        outletIds = staffOutlets.map((so: any) => so.outlet_id)
      }
    }

    const { data: requests, error: reqErr } = await supabaseAdmin
      .from('bypass_requests')
      .select(`
        id,
        outlet_id,
        requested_by_name,
        reason,
        status,
        created_at,
        outlets (
          name
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100)

    if (reqErr) throw reqErr

    let filteredRequests = requests || []
    if (role === 'area_manager' || role === 'leader') {
      if (outletIds.length === 0) {
        filteredRequests = []
      } else {
        filteredRequests = filteredRequests.filter((r: any) => outletIds.includes(r.outlet_id))
      }
    } else if (role !== 'admin' && role !== 'regional_manager' && (role as string) !== 'superadmin') {
      return { success: false, data: [], error: 'Akses ditolak' }
    }

    const formattedData: BypassRequestItem[] = filteredRequests.map((r: any) => ({
      id: r.id,
      outlet_id: r.outlet_id,
      outlet_name: r.outlets?.name || 'Unknown Outlet',
      requested_by_name: r.requested_by_name || 'Kasir',
      reason: r.reason || '-',
      status: r.status,
      created_at: r.created_at,
    }))

    return { success: true, data: formattedData }
  } catch (err: any) {
    console.error('Error fetching bypass requests:', err)
    return { success: false, error: err.message, data: [] }
  }
}

export async function processBypassRequest(requestId: string, action: 'approve' | 'reject') {
  try {
    const headersList = await headers()
    const staff = parseStaffHeader(headersList.get(STAFF_HEADER))

    if (!staff) return { success: false, error: 'Unauthorized' }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: request, error: fetchErr } = await supabaseAdmin
      .from('bypass_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchErr || !request) {
      return { success: false, error: 'Pengajuan bypass tidak ditemukan' }
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'Pengajuan bypass sudah diproses sebelumnya' }
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    const { error: updateErr } = await supabaseAdmin
      .from('bypass_requests')
      .update({
        status: newStatus,
        resolved_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (updateErr) throw updateErr

    return { success: true, newStatus }
  } catch (err: any) {
    console.error('Error processing bypass request:', err)
    return { success: false, error: err.message }
  }
}
