import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Dipanggil dari app/kasir saat kasir membatalkan order (cancelOrder)
// yang sumbernya online (source = 'online').
// Mengupdate langsung status order-system ke 'cancelled' via Supabase Service Key.
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
    return NextResponse.json({ success: true, skipped: true })
  }

  const ssOrderUrl = process.env.NEXT_PUBLIC_SS_ORDER_URL
  const ssOrderServiceKey = process.env.SS_ORDER_SERVICE_KEY

  if (!ssOrderUrl || !ssOrderServiceKey) {
    console.error('NEXT_PUBLIC_SS_ORDER_URL / SS_ORDER_SERVICE_KEY belum dikonfigurasi')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  try {
    const ssOrderDb = createClient(ssOrderUrl, ssOrderServiceKey)
    
    // Update langsung ke database order-system
    const { error: updateErr } = await ssOrderDb
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', order.external_order_id)

    if (updateErr) {
      console.error('Gagal update database order-system:', updateErr)
      return NextResponse.json({ error: 'Gagal update database order-system' }, { status: 502 })
    }
  } catch (err) {
    console.error('Gagal menghubungi order-system:', err)
    return NextResponse.json({ error: 'Gagal menghubungi order-system' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
