import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildMenuNameIndex, resolveMenuItemId } from '@/lib/resolve-menu-id'

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
  const authHeader = request.headers.get('authorization')
  let incomingToken = request.headers.get('x-internal-token') ?? ''
  if (authHeader && authHeader.startsWith('Bearer ')) {
    incomingToken = authHeader.substring(7)
  }
  
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

  // Idempotency ketat: cek id ATAU external_order_id (Cek apakah sudah ada dari offline / pull-online)
  const { data: existingList } = await supabaseService
    .from('orders')
    .select('id, status, source, external_order_id, outlet_id, order_number')
    .eq('outlet_id', pos_outlet_id)
    .or(`id.eq.${external_order_id},external_order_id.eq.${external_order_id}`)
    .limit(1)

  let existing = existingList && existingList.length > 0 ? existingList[0] : null

  if (!existing) {
    // Soft-match fallback: cari order di outlet yang sama dengan nama pelanggan dan total yang sama dalam 1 jam terakhir
    // yang external_order_id nya masih null (dibuat oleh kasir/kiosk secara lokal)
    const timeLimit = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: softMatchList } = await supabaseService
      .from('orders')
      .select('id, status, source, external_order_id, outlet_id, order_number')
      .eq('outlet_id', pos_outlet_id)
      .eq('customer_name', customer_name)
      .eq('total_amount', total_amount)
      .is('external_order_id', null)
      .gte('created_at', timeLimit)
      .limit(1)

    if (softMatchList && softMatchList.length > 0) {
      existing = softMatchList[0]
      console.log(`Soft-match berhasil untuk order: ${existing.id}`)
    }
  }

  if (existing) {
    // Update ke online dan set external_order_id jika itu belum diset
    if (existing.source !== 'online' || !existing.external_order_id) {
      await supabaseService
        .from('orders')
        .update({
          source: 'online',
          sales_source: 'online',
          external_order_id: external_order_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    }

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

  // Buat order dan items secara atomic
  // Cocokkan nama menu -> menu_items.id milik pos-kasir. order-system memakai
  // database terpisah dengan id sendiri, jadi id-nya tak bisa dipakai langsung.
  // Tanpa ini `menu_item_id` NULL, dan trigger BOM melewati item ber-id NULL
  // sehingga bahan baku pesanan web tak pernah dipotong dari stok.
  const { data: menuRows } = await supabaseService.from('menu_items').select('id, name')
  const menuIndex = buildMenuNameIndex(menuRows)

  const { data: order, error: orderError } = await supabaseService.rpc('atomic_insert_order', {
    p_order: {
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
    },
    p_items: items.map((item) => ({
      menu_item_id: resolveMenuItemId(menuIndex, item.menu_item_name),
      menu_item_name: item.menu_item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }))
  })

  if (orderError || !order) {
    if ((orderError as any)?.code === '23505') {
      const { data: retryList } = await supabaseService
        .from('orders')
        .select('id, order_number')
        .or(`id.eq.${external_order_id},external_order_id.eq.${external_order_id}`)
        .limit(1)
      if (retryList && retryList.length > 0) {
        return NextResponse.json({
          success: true,
          message: 'Order sudah ditarik sebelumnya (race condition resolved)',
          order_id: retryList[0].id,
          order_number: retryList[0].order_number,
        })
      }
    }
    console.error('Gagal membuat order dari order-system:', orderError)
    return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    order_id: order.id,
    order_number: order.order_number,
  })
}
