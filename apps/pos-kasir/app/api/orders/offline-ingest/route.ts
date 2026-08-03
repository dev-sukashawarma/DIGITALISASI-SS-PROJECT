import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { OfflineIngestPayload } from '@/lib/offline'

// Menerima pesanan yang DIBUAT saat kasir offline, lalu dikirim ulang setelah
// jaringan pulih.
//
// Berbeda dari /api/orders/walk-in dan /api/orders/manual: endpoint ini TIDAK
// menghitung ulang harga atau promo. Transaksinya sudah terjadi, uangnya sudah
// diterima, dan struknya sudah dipegang pelanggan -- menghitung ulang hanya
// membuat order ditolak permanen saat menu/promo berubah.
//
// Yang tetap divalidasi: sesi kasir, kepemilikan outlet, bentuk data, dan
// idempotensi lewat client_order_id.

function isUuid(v: unknown): v is string {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(request: Request) {
  let body: OfflineIngestPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  if (!isUuid(body.client_order_id)) {
    return NextResponse.json({ error: 'client_order_id wajib berupa UUID' }, { status: 400 })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Pesanan kosong' }, { status: 400 })
  }
  if (!Number.isFinite(body.total_amount) || body.total_amount < 0) {
    return NextResponse.json({ error: 'total_amount tidak valid' }, { status: 400 })
  }
  if (!body.created_at || Number.isNaN(Date.parse(body.created_at))) {
    return NextResponse.json({ error: 'created_at tidak valid' }, { status: 400 })
  }

  const supabaseService = createServiceClient()
  const supabaseAuth = await createClient()

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 })
  }

  const { data: profile } = await supabaseService
    .from('outlet_staff')
    .select('outlet_id, role, name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 403 })
  }

  let outletId = profile.outlet_id
  if (profile.role === 'admin' && !outletId) {
    outletId = body.outlet_id
  }
  if (!outletId) {
    return NextResponse.json({ error: 'Akun Anda tidak terhubung ke cabang manapun' }, { status: 403 })
  }
  // Order offline hanya boleh masuk ke outlet milik kasir yang login.
  if (body.outlet_id !== outletId) {
    return NextResponse.json({ error: 'Outlet pesanan tidak sesuai akun kasir' }, { status: 403 })
  }

  // ── Idempotensi: percobaan ulang mengembalikan order yang sama ───────────
  const { data: existing } = await supabaseService
    .from('orders')
    .select('id, order_number')
    .eq('client_order_id', body.client_order_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      success: true,
      duplicate: true,
      order_id: existing.id,
      order_number: existing.order_number,
    })
  }

  // Soft-match: jika webhook (incoming/pull-online) sudah memasukkan order online
  // lebih dulu sebelum sinkronisasi offline ini.
  const timeLimit = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: softMatchData } = await supabaseService
    .from('orders')
    .select('id, order_number, client_order_id')
    .eq('outlet_id', outletId)
    .eq('customer_name', body.customer_name)
    .eq('total_amount', body.total_amount)
    .gte('created_at', timeLimit)
    .limit(1)

  if (softMatchData && softMatchData.length > 0) {
    const matched = softMatchData[0]
    // Jika match dan belum punya client_order_id, kita update dengan client_order_id
    if (!matched.client_order_id) {
      await supabaseService
        .from('orders')
        .update({ client_order_id: body.client_order_id })
        .eq('id', matched.id)
      
      console.log(`offline-ingest: Soft-match berhasil, update client_order_id untuk order ${matched.id}`)
      
      return NextResponse.json({
        success: true,
        order_id: matched.id,
        order_number: matched.order_number,
      })
    }
  }

  // ── Insert order. order_number SENGAJA tidak dikirim: trigger
  //    assign_order_number yang menetapkannya secara atomik. ───────────────
  const fullPayload = {
    outlet_id: outletId,
    client_order_id: body.client_order_id,
    customer_name: body.customer_name,
    cashier_name: profile.name || null,
    payment_method: body.payment_method,
    total_amount: body.total_amount,
    discount_amount: body.discount_amount,
    promo_subsidy: body.promo_subsidy ?? 0,
    payment_proof_url: body.payment_proof_url,
    amount_received: body.amount_received,
    change_amount: body.change_amount,
    status: 'preparing',
    kitchen_receipt_printed: true,
    source: body.source,
    channel: body.channel,
    sales_source: body.channel || body.source,
    // Waktu transaksi ASLI, bukan waktu sinkron -- kalau tidak, laporan
    // penjualan dan tutup shift ikut melenceng.
    created_at: body.created_at,
  }

  let order: { id: string; order_number: number } | null = null
  let orderError: any = null

  {
    const res = await supabaseService
      .from('orders')
      .insert(fullPayload)
      .select('id, order_number')
      .single()
    order = res.data
    orderError = res.error
  }

  if (orderError && (orderError.code === '42703' || orderError.code === 'PGRST204')) {
    const errorMsg = orderError.message || ''
    const fallbackPayload = { ...fullPayload }
    let shouldRetry = false

    if (/amount_received/i.test(errorMsg) || /change_amount/i.test(errorMsg)) {
      delete (fallbackPayload as any).amount_received
      delete (fallbackPayload as any).change_amount
      shouldRetry = true
    }
    
    if (/client_order_id/i.test(errorMsg)) {
      delete (fallbackPayload as any).client_order_id
      shouldRetry = true
    }

    if (orderError.code === 'PGRST204' && !shouldRetry) {
      delete (fallbackPayload as any).amount_received
      delete (fallbackPayload as any).change_amount
      delete (fallbackPayload as any).client_order_id
      shouldRetry = true
    }

    if (shouldRetry) {
      console.warn('offline-ingest: Kolom baru belum ada di DB atau schema cache usang. Insert dengan fallback payload.')
      const retryRes = await supabaseService
        .from('orders')
        .insert(fallbackPayload)
        .select('id, order_number')
        .single()
      order = retryRes.data
      orderError = retryRes.error
    }
  }

  if (orderError || !order) {
    // 23505 = unique_violation. Bisa terjadi kalau dua percobaan berlomba;
    // ambil hasil pemenangnya supaya percobaan yang kalah tidak dianggap gagal.
    if (orderError?.code === '23505') {
      const { data: raced } = await supabaseService
        .from('orders')
        .select('id, order_number')
        .eq('client_order_id', body.client_order_id)
        .maybeSingle()
      if (raced) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          order_id: raced.id,
          order_number: raced.order_number,
        })
      }
    }
    console.error('offline-ingest: gagal insert order', orderError)
    return NextResponse.json({ error: 'Gagal menyimpan pesanan offline' }, { status: 500 })
  }

  const { error: itemsError } = await supabaseService.from('order_items').insert(
    body.items.map((it) => ({
      order_id: order.id,
      menu_item_id: it.menu_item_id,
      menu_item_name: it.menu_item_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      subtotal: it.subtotal,
      package_choices: it.package_choices ?? null,
    }))
  )

  if (itemsError) {
    console.error('offline-ingest: gagal insert items', itemsError)
    await supabaseService.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Gagal menyimpan item pesanan' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    order_id: order.id,
    order_number: order.order_number,
  })
}
