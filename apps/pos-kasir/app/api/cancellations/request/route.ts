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

    // 1. Dapatkan outlet_id dari order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('outlet_id, order_number, customer_name, total_amount, status')
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 2. Cari Leader untuk outlet tersebut
    let leaderPhone: string | null = null;
    let outletName = 'Outlet';

    // Ambil nama outlet
    const { data: outletData } = await supabase
      .from('outlets')
      .select('name')
      .eq('id', order.outlet_id)
      .single()
    
    if (outletData) {
      outletName = outletData.name;
    }

    // Semua verifikasi pembatalan (void) diarahkan ke nomor terpusat
    leaderPhone = '085885497377';

    if (!leaderPhone) {
      return NextResponse.json({ error: 'Leader not found or no WhatsApp number set for this outlet' }, { status: 404 })
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

    // 5. Generate Magic Link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pos.sukashawarma.com' // Ganti jika perlu
    const magicLink = `${baseUrl}/cancellations/approve?token=${request.token}`

    // 6. Generate WA URL
    const message = `*PERMINTAAN PEMBATALAN PESANAN*\n\nOutlet: ${outletName}\nNo Order: ${order.order_number}\nPelanggan: ${order.customer_name}\nTotal: Rp ${order.total_amount.toLocaleString('id-ID')}\nAlasan: ${reason}\n\nSilakan klik link berikut untuk *MENYETUJUI* atau *MENOLAK* pembatalan ini (link hanya berlaku 1 kali):\n\n${magicLink}`
    
    // Format WA number: Ensure starts with 62 or +62
    let phone = leaderPhone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '62' + phone.substring(1)

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

    return NextResponse.json({ waUrl })
  } catch (error: any) {
    console.error('Cancellation Request Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
