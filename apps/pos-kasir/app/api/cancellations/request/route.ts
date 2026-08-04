import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRequestStaff } from '@/lib/authz'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { order_id, reason } = await req.json()

    if (!order_id || !reason) {
      return NextResponse.json({ error: 'Missing order_id or reason' }, { status: 400 })
    }

    // Insert di bawah pakai service-role client -> trigger DB
    // (stamp_requested_by_from_auth) tidak bisa menstempel auth.uid() karena
    // konteksnya bukan sesi user. Wajib diverifikasi & dikirim eksplisit di
    // sini supaya kolom requested_by bisa dipercaya untuk cek approver≠requester
    // di action/route.ts.
    const staff = await getRequestStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan, silakan login ulang.' }, { status: 401 })
    }

    // Ambil nama crew untuk histori
    const { data: staffData } = await supabase
      .from('outlet_staff')
      .select('name')
      .eq('id', staff.id)
      .single()
    const staffName = staffData?.name || 'Unknown'

    // 1. Dapatkan outlet_id dari order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('outlet_id, order_number, customer_name, total_amount, status')
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 3. Hitung waktu kedaluwarsa token (misal 24 jam dari sekarang)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // 4. Buat record di cancellation_requests
    const { data: request, error: reqErr } = await supabase
      .from('cancellation_requests')
      .insert({
        order_id,
        reason,
        expires_at: expiresAt.toISOString(),
        // Perlu untuk restore status yang benar kalau ditolak — order bisa
        // diajukan cancel dari status 'pending' MAUPUN 'preparing', jangan
        // hardcode balik ke 'pending' (lihat action/route.ts).
        previous_order_status: order.status,
        requested_by: staff.id
      })
      .select('token')
      .single()

    if (reqErr || !request) {
      return NextResponse.json({ error: 'Failed to create cancellation request' }, { status: 500 })
    }

    // 4b. Update nama crew & alasan di orders agar tampil di histori
    await supabase
      .from('orders')
      .update({ 
        cancellation_reason: reason ? `${reason} [Diajukan oleh: ${staffName}]` : `[Diajukan oleh: ${staffName}]`
      })
      .eq('id', order_id)

    return NextResponse.json({ success: true, message: 'Menunggu persetujuan Area Manager' })
  } catch (error: any) {
    console.error('Cancellation Request Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
