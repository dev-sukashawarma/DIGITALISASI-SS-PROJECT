'use server'

import { cookies, headers } from 'next/headers'
import { createSupabaseServerClient, parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function getVoidOrders() {
  try {
    const cookieStore = await cookies()
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

    // Query cancellation requests yang pending
    let query = supabaseAdmin
      .from('cancellation_requests')
      .select(`
        id,
        order_id,
        reason,
        status,
        created_at,
        token,
        orders (
          order_number,
          customer_name,
          total_amount,
          status,
          outlet_id,
          outlets (
            id,
            name
          ),
          order_items (
            menu_item_name,
            quantity,
            subtotal
          )
        ),
        outlet_staff!requested_by (
          name
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100)

    const { data: requests, error: reqErr } = await query

    if (reqErr) throw reqErr

    // Filter by outletIds jika area_manager / leader
    let filteredRequests = requests || []
    if (role === 'area_manager' || role === 'leader') {
      if (outletIds.length === 0) {
         filteredRequests = [] // tidak ada outlet yg dibawahi
      } else {
         filteredRequests = filteredRequests.filter((r: any) => outletIds.includes(r.orders?.outlet_id))
      }
    } else if (role !== 'admin' && role !== 'regional_manager') {
       // Selain admin/rm/am/leader, nggak punya akses
       return { success: false, data: [], error: 'Akses ditolak' }
    }

    const formattedData = filteredRequests.map((r: any) => ({
      id: r.id,
      order_id: r.order_id,
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
      token: r.token,
      order_number: r.orders?.order_number,
      customer_name: r.orders?.customer_name,
      total_amount: r.orders?.total_amount,
      outlet_name: r.orders?.outlets?.name || 'Unknown Outlet',
      requester_name: r.outlet_staff?.name || 'Unknown Staff',
      order_items: r.orders?.order_items || []
    }))

    return { success: true, data: formattedData }
  } catch (err: any) {
    console.error('Error fetching void orders:', err)
    return { success: false, error: err.message, data: [] }
  }
}

export async function processVoidOrder(tokenId: string, action: 'approve' | 'reject') {
  try {
    const headersList = await headers()
    const staff = parseStaffHeader(headersList.get(STAFF_HEADER))

    if (!staff) return { success: false, error: 'Unauthorized' }

    const supabaseAdmin = getSupabaseAdmin()

    // Dapatkan request
    const { data: request, error: reqErr } = await supabaseAdmin
      .from('cancellation_requests')
      .select('*')
      .eq('token', tokenId)
      .single()

    if (reqErr || !request) {
      return { success: false, error: 'Token tidak valid' }
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'Pengajuan sudah diproses' }
    }

    if (request.requested_by === staff.id) {
      return { success: false, error: 'Anda tidak bisa menyetujui pengajuan Anda sendiri' }
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // Update request
    const { error: updateReqErr } = await supabaseAdmin
      .from('cancellation_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', request.id)

    if (updateReqErr) throw updateReqErr

    // Update order
    const { error: updateOrderErr } = await supabaseAdmin
      .from('orders')
      .update({
        cancellation_status: newStatus,
        status: newStatus === 'approved' ? 'cancelled' : (request.previous_order_status ?? 'pending')
      })
      .eq('id', request.order_id)

    if (updateOrderErr) throw updateOrderErr

    return { success: true, newStatus }
  } catch (err: any) {
    console.error('Process void order error:', err)
    return { success: false, error: err.message }
  }
}
