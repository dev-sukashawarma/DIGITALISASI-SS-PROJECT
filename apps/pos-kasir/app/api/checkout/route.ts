import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { validateCheckoutPayload } from '@/lib/validations'
import type { CheckoutPayload } from '@/types'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  // Validasi struktur request
  const errors = validateCheckoutPayload(body)
  if (errors.length > 0) {
    return NextResponse.json(
      { error: errors[0].message, details: errors },
      { status: 400 }
    )
  }

  const payload = body as CheckoutPayload

  // Ambil auth token dari request (via server client biasa)
  // Untuk identifikasi Outlet yang valid
  const supabaseService = createServiceClient()
  
  const cookieStore = cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Kiosk tidak terautentikasi' }, { status: 401 })
  }

  const { data: profile } = await supabaseService
    .from('profiles')
    .select('outlet_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Sesi tidak valid, profil tidak ditemukan' }, { status: 403 })
  }

  let outlet_id = profile.outlet_id

  // Berikan kelonggaran untuk Admin yang ingin mengetes Kiosk
  if (profile.role === 'admin' && !outlet_id) {
    const { data: defaultOutlet } = await supabaseService.from('outlets').select('id').limit(1).single()
    if (defaultOutlet) {
      outlet_id = defaultOutlet.id
    }
  }

  if (!outlet_id) {
    return NextResponse.json({ error: 'Akun Anda tidak memiliki Cabang (Outlet) yang terhubung.' }, { status: 403 })
  }

  // Ambil data menu dari database (harga otoritatif dari server)
  const menuItemIds = payload.items.map((i) => i.menu_item_id)
  const { data: menuItems, error: menuError } = await supabaseService
    .from('menu_items')
    .select('id, name, price, is_available')
    .in('id', menuItemIds)

  if (menuError) {
    return NextResponse.json({ error: 'Gagal memuat data menu' }, { status: 500 })
  }

  // Validasi setiap item: harus ada, harus tersedia
  const validatedItems: {
    menu_item_id: string
    menu_item_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }[] = []

  let total = 0

  for (const reqItem of payload.items) {
    const menuItem = menuItems?.find((m) => m.id === reqItem.menu_item_id)

    if (!menuItem) {
      return NextResponse.json(
        { error: `Menu tidak ditemukan (ID: ${reqItem.menu_item_id})` },
        { status: 400 }
      )
    }

    if (!menuItem.is_available) {
      return NextResponse.json(
        { error: `"${menuItem.name}" sedang tidak tersedia` },
        { status: 400 }
      )
    }

    const quantity = Number(reqItem.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return NextResponse.json(
        { error: `Jumlah untuk "${menuItem.name}" harus antara 1-10` },
        { status: 400 }
      )
    }

    // Gunakan harga dari DATABASE, bukan dari frontend
    const unitPrice = menuItem.price
    const subtotal = unitPrice * quantity

    total += subtotal
    
    // Embed relationship data using separators
    let finalName = menuItem.name
    if (reqItem.cartItemId) {
      finalName += `|ID|${reqItem.cartItemId}`
    }
    if (reqItem.parentId) {
      finalName += `|PARENT|${reqItem.parentId}`
    }
    if (reqItem.note && reqItem.note.trim() !== '') {
      finalName += `|NOTE|${reqItem.note.trim()}`
    }

    validatedItems.push({
      menu_item_id: menuItem.id,
      menu_item_name: finalName,
      quantity,
      unit_price: unitPrice,
      subtotal,
    })
  }

  // Buat order
  const { data: order, error: orderError } = await supabaseService
    .from('orders')
    .insert({
      outlet_id: outlet_id,
      customer_name: payload.customer_name || null,
      notes: null,
      payment_method: payload.payment_method,
      total_amount: total,
      status: 'pending',
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    console.error('Order creation error:', orderError)
    return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 500 })
  }

  // Buat order items
  const { error: itemsError } = await supabaseService.from('order_items').insert(
    validatedItems.map((item) => ({
      ...item,
      order_id: order.id,
    }))
  )

  if (itemsError) {
    console.error('Order items error:', itemsError)
    // Rollback: hapus order jika items gagal
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
