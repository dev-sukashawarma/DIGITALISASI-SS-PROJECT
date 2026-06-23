import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CHANNELS } from '@/lib/channels'

// Endpoint dipanggil dari halaman /kasir/order-manual saat kasir membuat
// pesanan dari channel eksternal (GoFood, ShopeeFood, dll).
//
// Berbeda dari /api/checkout (kiosk pelanggan):
// - butuh `channel` (wajib, salah satu dari CHANNELS)
// - order langsung dibuat status 'preparing' (Diproses), source 'manual'
// - payment_method hanya dicatat sebagai label (tidak generate QRIS)

interface ManualItem {
  menu_item_id: string
  quantity: number
  note?: string
}

interface ManualPayload {
  channel: string
  payment_method: 'cash' | 'qris'
  customer_name?: string
  items: ManualItem[]
}

const VALID_CHANNELS = new Set(CHANNELS.map((c) => c.id))

export async function POST(request: Request) {
  let body: ManualPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  // ── Validasi dasar ──────────────────────────────────────────────────────
  if (!body.channel || !VALID_CHANNELS.has(body.channel)) {
    return NextResponse.json({ error: 'Channel tidak valid' }, { status: 400 })
  }
  if (body.payment_method !== 'cash' && body.payment_method !== 'qris') {
    return NextResponse.json({ error: 'Metode pembayaran tidak valid' }, { status: 400 })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Pesanan kosong, pilih minimal 1 menu' }, { status: 400 })
  }

  // ── Autentikasi kasir & ambil outlet ────────────────────────────────────
  const supabaseService = createServiceClient()
  const supabaseAuth = await createClient()

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 })
  }

  const { data: profile } = await supabaseService
    .from('outlet_staff')
    .select('outlet_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 403 })
  }

  let outlet_id = profile.outlet_id
  if (profile.role === 'admin' && !outlet_id) {
    const { data: defaultOutlet } = await supabaseService.from('outlets').select('id').limit(1).single()
    if (defaultOutlet) outlet_id = defaultOutlet.id
  }
  if (!outlet_id) {
    return NextResponse.json({ error: 'Akun Anda tidak terhubung ke cabang manapun' }, { status: 403 })
  }

  // ── Ambil harga otoritatif dari DB (abaikan harga dari client) ──────────
  const menuItemIds = body.items.map((i) => i.menu_item_id)
  const { data: menuItems, error: menuError } = await supabaseService
    .from('menu_items')
    .select('id, name, price, is_available')
    .in('id', menuItemIds)

  if (menuError) {
    return NextResponse.json({ error: 'Gagal memuat data menu' }, { status: 500 })
  }

  const validatedItems: {
    menu_item_id: string
    menu_item_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }[] = []

  let total = 0

  for (const reqItem of body.items) {
    const menuItem = menuItems?.find((m) => m.id === reqItem.menu_item_id)
    if (!menuItem) {
      return NextResponse.json({ error: `Menu tidak ditemukan (ID: ${reqItem.menu_item_id})` }, { status: 400 })
    }
    if (!menuItem.is_available) {
      return NextResponse.json({ error: `"${menuItem.name}" sedang tidak tersedia` }, { status: 400 })
    }

    const quantity = Number(reqItem.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return NextResponse.json({ error: `Jumlah untuk "${menuItem.name}" harus 1-10` }, { status: 400 })
    }

    const unitPrice = menuItem.price
    const subtotal = unitPrice * quantity
    total += subtotal

    // Konvensi |NOTE| supaya catatan per-item diparsing UI kasir
    const note = (reqItem.note ?? '').trim()
    const finalName = note ? `${menuItem.name}|NOTE|${note}` : menuItem.name

    validatedItems.push({
      menu_item_id: menuItem.id,
      menu_item_name: finalName,
      quantity,
      unit_price: unitPrice,
      subtotal,
    })
  }

  // ── Buat order langsung status 'preparing' (Diproses) ───────────────────
  const customerName = (body.customer_name ?? '').trim()
  const mappedSource = body.channel === 'tiktokgo' ? 'tiktok' : body.channel;
  const validSalesSource = ['pos','online','gofood','grabfood','shopeefood','tiktok'].includes(mappedSource) ? mappedSource : 'pos';

  const { data: order, error: orderError } = await supabaseService
    .from('orders')
    .insert({
      outlet_id,
      customer_name: customerName || null,
      payment_method: body.payment_method,
      total_amount: total,
      status: 'preparing',
      source: 'manual',
      channel: body.channel,
      sales_source: validSalesSource,
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    console.error('Gagal membuat order manual:', orderError)
    return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 500 })
  }

  const { error: itemsError } = await supabaseService.from('order_items').insert(
    validatedItems.map((item) => ({ ...item, order_id: order.id }))
  )

  if (itemsError) {
    console.error('Gagal menyimpan item order manual:', itemsError)
    await supabaseService.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Gagal menyimpan item pesanan' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    order_id: order.id,
    order_number: order.order_number,
    total_amount: total,
  })
}
