import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Dipanggil dari app/kasir saat status pesanan aplikasi berubah
// (misal: 'preparing' saat mulai masak, 'completed' saat pesanan selesai/diambil).
// Meneruskan sinyal ke Retail Gateway internal API agar notifikasi pelanggan terbit.
export async function POST(request: Request) {
  let body: { order_id: string; status: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  const { order_id, status } = body
  if (!order_id || !status) {
    return NextResponse.json({ error: 'order_id dan status wajib diisi' }, { status: 400 })
  }

  const supabaseService = createServiceClient()
  const { data: order } = await supabaseService
    .from('orders')
    .select('id, source, sales_source, order_number')
    .eq('id', order_id)
    .single()

  // Hanya proses jika pesanan berasal dari aplikasi retail (source = 'app')
  if (!order || (order.source !== 'app' && order.sales_source !== 'app')) {
    return NextResponse.json({ success: true, skipped: true })
  }

  const gatewayUrl = process.env.RETAIL_GATEWAY_URL || 'https://retail.sukashawarma.com'
  const secret = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET || ''

  try {
    const res = await fetch(`${gatewayUrl}/api/internal/orders/status-changed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify({
        order_id,
        status,
        order_number: order.order_number,
      }),
    })

    if (!res.ok) {
      console.warn('Gagal meneruskan status pesanan ke retail gateway:', res.status)
      return NextResponse.json({ success: false, gateway_status: res.status }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.warn('Error menghubungi retail gateway:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
