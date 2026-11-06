import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requirePosCaller, staffCanTouchOutlet } from '@/lib/posApiGate'

const ALLOWED_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled']

// Ubah status order dengan service role (bypass RLS).
// Pengamanan (2026-11-06): dulu cukup "punya sesi Supabase" — akun apa pun
// (termasuk pelanggan aplikasi) bisa mengubah status order outlet mana pun ke
// nilai apa pun, dan `voided_by` diambil dari body. Kini wajib staf POS aktif,
// order harus di outlet yang boleh ia akses, status dibatasi, dan `voided_by`
// diisi dari sesi.
export async function POST(request: Request) {
  const caller = await requirePosCaller(request)
  if (caller instanceof NextResponse) return caller

  try {
    const body = await request.json()
    const { order_id, status, void_reason, void_at } = body

    if (!order_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const supabaseService = createServiceClient()

    const { data: order } = await supabaseService
      .from('orders')
      .select('id, outlet_id')
      .eq('id', order_id)
      .maybeSingle()
    if (!order) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 })
    }
    if (caller.via === 'staff' && !(await staffCanTouchOutlet(request, caller.outletId, order.outlet_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (void_reason) updateData.void_reason = void_reason
    if (void_at) updateData.void_at = void_at
    if (status === 'cancelled' && caller.via === 'staff') updateData.voided_by = caller.staffId

    const { error: updateError } = await supabaseService
      .from('orders')
      .update(updateData)
      .eq('id', order_id)

    if (updateError) {
      console.error('Failed to update order status:', updateError)
      return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Internal API error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
