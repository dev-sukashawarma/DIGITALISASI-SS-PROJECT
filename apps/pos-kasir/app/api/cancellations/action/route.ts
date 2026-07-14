import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { token, action } = await req.json() // action: 'approve' | 'reject'

    if (!token || !action) {
      return NextResponse.json({ error: 'Missing token or action' }, { status: 400 })
    }

    // 1. Dapatkan request dari token
    const { data: request, error: reqErr } = await supabase
      .from('cancellation_requests')
      .select('*')
      .eq('token', token)
      .single()

    if (reqErr || !request) {
      return NextResponse.json({ error: 'Token tidak valid atau tidak ditemukan.' }, { status: 404 })
    }

    // 2. Cek apakah sudah expired
    if (new Date(request.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Link ini sudah kedaluwarsa.' }, { status: 400 })
    }

    // 3. Cek status
    if (request.status !== 'pending') {
      return NextResponse.json({ error: `Link ini sudah digunakan. Status saat ini: ${request.status}.` }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // 4. Update request status
    const { error: updateReqErr } = await supabase
      .from('cancellation_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', request.id)

    if (updateReqErr) throw updateReqErr

    // 5. Update order cancellation_status
    // Jika approved, kasir akan mengecek ordernya dan melihat status approved.
    // Tapi wait, status order.status sudah 'cancelled' oleh kasir sebelumnya? 
    // Di logic baru, kasir akan set order.status tetap 'pending' tapi cancellation_status 'pending_approval' ?
    // Atau kasir sudah set ke 'cancelled' tapi butuh diapprove?
    // Lebih aman: Kasir membatalkan secara UI (cancelled) tapi real statusnya di database cancellation_status = 'pending_approval'.
    // Kalau approve -> order tetap cancelled, cancellation_status = 'approved'.
    // Kalau reject -> order dikembalikan ke pending atau dibatalkan?
    // Tergantung requirement. Jika "pembatalan harus disetujui", maka kasir tidak bisa mengubah status ke cancelled sampai disetujui.
    // Tapi requirement awal: kasir minta batal -> link dikirim ke WA -> kasir nunggu / atau order digantung?
    
    const { error: updateOrderErr } = await supabase
      .from('orders')
      .update({ 
        cancellation_status: newStatus,
        status: newStatus === 'approved' ? 'cancelled' : 'pending' // kalau di-reject kembali ke pending
      })
      .eq('id', request.order_id)

    if (updateOrderErr) throw updateOrderErr

    return NextResponse.json({ success: true, newStatus })
  } catch (error: any) {
    console.error('Cancellation Action Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
