import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Perbandingan constant-time untuk cegah timing attack pada token comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

interface IncomingOrderPayload {
  external_order_id: string
  pos_outlet_id: string
  customer_name: string
  customer_phone: string
  total_amount: number
  notes?: string
  items: {
    menu_item_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }[]
}

// Endpoint dipanggil oleh order-system (Edge Function push-order-to-kasir)
// saat pembayaran customer berhasil dikonfirmasi.
export async function POST(request: Request) {
  const incomingToken = request.headers.get('x-internal-token') ?? ''
  const expectedToken = process.env.ORDER_TO_KASIR_SECRET

  if (!expectedToken) {
    console.error('ORDER_TO_KASIR_SECRET belum dikonfigurasi')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  if (!incomingToken || !timingSafeEqual(incomingToken, expectedToken)) {
    console.error('Token order-system tidak valid')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: IncomingOrderPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  const { external_order_id, pos_outlet_id, customer_name, customer_phone, total_amount, notes, items } = body

  if (!external_order_id || !pos_outlet_id || !customer_phone || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
  }

  const supabaseService = createServiceClient()

  // Idempotency: kalau order ini sudah pernah masuk, jangan duplikat
  const { data: existing } = await supabaseService
    .from('orders')
    .select('id, order_number')
    .eq('external_order_id', external_order_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      success: true,
      message: 'Order sudah pernah diterima sebelumnya (idempoten)',
      order_id: existing.id,
      order_number: existing.order_number,
    })
  }

  const { data: outlet } = await supabaseService
    .from('outlets')
    .select('id')
    .eq('id', pos_outlet_id)
    .single()

  if (!outlet) {
    console.error('Outlet tidak ditemukan untuk pos_outlet_id:', pos_outlet_id)
    return NextResponse.json({ error: 'Outlet tidak ditemukan' }, { status: 400 })
  }

  const { data: order, error: orderError } = await supabaseService
    .from('orders')
    .insert({
      outlet_id: pos_outlet_id,
      customer_name,
      customer_phone,
      notes: notes || null,
      payment_method: 'qris',
      total_amount,
      status: 'preparing', // Langsung diproses karena dari website sudah dibayar
      source: 'online',
      sales_source: 'online',
      external_order_id,
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    console.error('Gagal membuat order dari order-system:', orderError)
    return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 500 })
  }

  const { error: itemsError } = await supabaseService.from('order_items').insert(
    items.map((item) => ({
      order_id: order.id,
      menu_item_id: null,
      menu_item_name: item.menu_item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }))
  )

  if (itemsError) {
    console.error('Gagal menyimpan item order online:', itemsError)
    await supabaseService.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Gagal menyimpan item pesanan' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    order_id: order.id,
    order_number: order.order_number,
  })
}
