import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Dipanggil dari app/kasir saat kasir menekan "Tandai Selesai" pada order
// yang sumbernya online (source = 'online'). Meneruskan notifikasi ke
// order-system supaya WA "pesanan siap diambil" terkirim ke customer.
export async function POST(request: Request) {
  let body: { order_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  const { order_id } = body
  if (!order_id) {
    return NextResponse.json({ error: 'order_id wajib diisi' }, { status: 400 })
  }

  const supabaseService = createServiceClient()
  const { data: order } = await supabaseService
    .from('orders')
    .select('id, source, external_order_id')
    .eq('id', order_id)
    .single()

  if (!order || order.source !== 'online' || !order.external_order_id) {
    // Bukan order online, tidak perlu notifikasi ke order-system
    return NextResponse.json({ success: true, skipped: true })
  }

  const notifyUrl = process.env.ORDER_SYSTEM_NOTIFY_URL
  const secret = process.env.KASIR_TO_ORDER_SECRET

  if (!notifyUrl || !secret) {
    console.error('ORDER_SYSTEM_NOTIFY_URL / KASIR_TO_ORDER_SECRET belum dikonfigurasi')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  try {
    const res = await fetch(notifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': secret,
      },
      body: JSON.stringify({ external_order_id: order.external_order_id }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('order-system menolak notifikasi selesai:', res.status, text)
      return NextResponse.json({ error: 'Gagal meneruskan notifikasi ke order-system' }, { status: 502 })
    }
  } catch (err) {
    console.error('Gagal memanggil order-system:', err)
    return NextResponse.json({ error: 'Gagal menghubungi order-system' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
