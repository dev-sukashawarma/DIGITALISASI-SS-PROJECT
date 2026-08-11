'use server'

import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_ROLES = ['area_manager', 'leader', 'regional_manager', 'admin']

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function requireStaffWithOutletAccess(outletId: string) {
  const headersList = await headers()
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER))
  if (!staff) return { error: 'Belum login' as const }
  if (!ALLOWED_ROLES.includes(staff.role)) return { error: 'Akses ditolak' as const }

  const supabaseAdmin = getSupabaseAdmin()

  if (staff.role === 'area_manager' || staff.role === 'leader') {
    const { data: staffOutlets } = await supabaseAdmin
      .from('staff_outlets')
      .select('outlet_id')
      .eq('staff_id', staff.id)
    const outletIds = (staffOutlets || []).map((so: any) => so.outlet_id)
    if (!outletIds.includes(outletId)) {
      return { error: 'Outlet ini bukan tanggung jawab Anda' as const }
    }
  }

  return { staff, supabaseAdmin }
}

export async function searchCompletedOrders(outletId: string, query: string) {
  const auth = await requireStaffWithOutletAccess(outletId)
  if ('error' in auth) return { success: false, error: auth.error, data: [] }
  const { supabaseAdmin } = auth

  const trimmed = query.trim()
  if (!trimmed) return { success: true, data: [] }

  let q = supabaseAdmin
    .from('orders')
    .select('id, order_number, customer_name, total_amount, created_at')
    .eq('outlet_id', outletId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20)

  q = /^\d+$/.test(trimmed)
    ? q.eq('order_number', parseInt(trimmed, 10))
    : q.ilike('customer_name', `%${trimmed}%`)

  const { data, error } = await q
  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data: data || [] }
}

export async function forceCancelCompletedOrder(orderId: string, outletId: string, note: string) {
  const trimmedNote = note.trim()
  if (!trimmedNote) return { success: false, error: 'Catatan pembatalan wajib diisi' }

  const auth = await requireStaffWithOutletAccess(outletId)
  if ('error' in auth) return { success: false, error: auth.error }
  const { staff, supabaseAdmin } = auth

  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('id, status, outlet_id')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) return { success: false, error: 'Order tidak ditemukan' }
  if (order.outlet_id !== outletId) return { success: false, error: 'Order bukan milik outlet ini' }
  if (order.status !== 'completed') {
    return { success: false, error: 'Hanya order berstatus selesai yang bisa dibatalkan lewat menu ini' }
  }

  const { error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'cancelled',
      cancellation_status: 'approved',
      cancellation_reason: `Dibatalkan paksa oleh ${staff.name} (${staff.role}): ${trimmedNote}`,
    })
    .eq('id', orderId)

  if (updateErr) return { success: false, error: updateErr.message }
  return { success: true }
}
