import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { calculateReleaseTime, calculateTotalPrepTime, parsePickupTime } from '@/lib/prepTime'

export async function POST(request: Request) {
  let body: { external_order_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  const { external_order_id } = body
  if (!external_order_id) {
    return NextResponse.json({ error: 'external_order_id wajib diisi' }, { status: 400 })
  }

  const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL
  const SS_ORDER_KEY = process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY

  if (!SS_ORDER_URL || !SS_ORDER_KEY) {
    return NextResponse.json({ error: 'Kredensial SS_ORDER tidak dikonfigurasi' }, { status: 500 })
  }

  const ssOrderDb = createClient(SS_ORDER_URL, SS_ORDER_KEY)
  const posDb = createServiceClient()

  // 1. Cek idempotency ketat di pos-kasir (cegah duplikasi order id / external_order_id)
  const { data: existing } = await posDb
    .from('orders')
    .select('id, order_number')
    .or(`id.eq.${external_order_id},external_order_id.eq.${external_order_id}`)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      success: true,
      message: 'Order sudah ditarik sebelumnya',
      order_id: existing.id,
      order_number: existing.order_number,
    })
  }

  // 2. Ambil data order dari SS_ORDER
  const { data: order, error: orderErr } = await ssOrderDb
    .from('orders')
    .select(`
      id, customer_name, customer_wa, total, notes, outlet_id, pickup_time,
      outlets!inner(pos_outlet_id),
      order_items(item_name, quantity, unit_price, note)
    `)
    .eq('id', external_order_id)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order tidak ditemukan di SS_ORDER' }, { status: 404 })
  }

  const posOutletId = Array.isArray(order.outlets) 
    ? (order.outlets[0] as any)?.pos_outlet_id 
    : (order.outlets as any)?.pos_outlet_id
  
  if (!posOutletId) {
    return NextResponse.json({ error: 'Outlet belum dipetakan ke POS Kasir (pos_outlet_id kosong)' }, { status: 400 })
  }

  // Parse pickup time and calculate release time
  const pickupTime = parsePickupTime(order.pickup_time)
  let releaseTime = null

  if (pickupTime) {
    // Estimasi total waktu masak (default prep_time 10 jika menu tidak ditemukan/disediakan)
    const itemsForPrep = order.order_items?.map((i: any) => ({
      quantity: i.quantity,
      prep_time: 10 // Karena ini dari online (tanpa menu_item_id langsung), kita asumsikan 10
    })) || []
    const totalPrepTime = calculateTotalPrepTime(itemsForPrep)
    releaseTime = calculateReleaseTime(pickupTime, totalPrepTime)
  }

  // 3. Masukkan ke pos-kasir
  const { data: newOrder, error: insertErr } = await posDb
    .from('orders')
    .insert({
      outlet_id: posOutletId,
      customer_name: order.customer_name,
      customer_phone: order.customer_wa,
      notes: order.notes || null,
      payment_method: 'qris',
      total_amount: order.total,
      status: 'preparing',
      source: 'online',
      sales_source: 'online',
      external_order_id: order.id,
      pickup_time: pickupTime ? pickupTime.toISOString() : null,
      release_time: releaseTime ? releaseTime.toISOString() : null,
    })
    .select('id, order_number')
    .single()

  if (insertErr || !newOrder) {
    console.error('Gagal insert order ke pos-kasir:', insertErr)
    return NextResponse.json({ error: 'Gagal menyimpan pesanan ke database kasir' }, { status: 500 })
  }

  // 4. Masukkan items
  const items = order.order_items || []
  if (items.length > 0) {
    const { error: itemsErr } = await posDb.from('order_items').insert(
      items.map((i: any) => ({
        order_id: newOrder.id,
        menu_item_id: null,
        menu_item_name: i.note ? `${i.item_name}|NOTE|${i.note}` : i.item_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.unit_price * i.quantity,
      }))
    )
    if (itemsErr) {
      console.error('Gagal insert order items:', itemsErr)
    }
  }

  return NextResponse.json({
    success: true,
    order_id: newOrder.id,
    order_number: newOrder.order_number,
  })
}
