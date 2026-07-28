import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateCheckoutPayload } from '@/lib/validations'
import type { CheckoutPayload } from '@/types'
import { calculateItemPrice, calculateGlobalDiscount, BasePromo } from '@/lib/promo-calculator'

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
  
  const supabaseAuth = await createClient()

  const { data: { user } } = await supabaseAuth.auth.getUser()
  
  let outlet_id = '550e8400-e29b-41d4-a716-446655440001' // Default to Pusat for Kiosk Mode

  if (user) {
    const { data: profile } = await supabaseService
      .from('outlet_staff')
      .select('outlet_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Sesi tidak valid, profil tidak ditemukan' }, { status: 403 })
    }
    
    // If Admin is testing Kiosk, use the Pusat ID. Else use their outlet_id.
    if (profile.role === 'admin' && !profile.outlet_id) {
       outlet_id = '550e8400-e29b-41d4-a716-446655440001'
    } else if (profile.outlet_id) {
       outlet_id = profile.outlet_id
    } else {
       return NextResponse.json({ error: 'Akun Anda tidak memiliki Cabang (Outlet) yang terhubung.' }, { status: 403 })
    }
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

  // Fetch active promos for this outlet
  const { data: activePromos, error: promosError } = await supabaseService
    .from('outlet_promos')
    .select('*')
    .eq('outlet_id', outlet_id)
    .eq('is_active', true)

  const globalPromo = activePromos?.find(p => p.scope === 'global')
  const itemPromos = activePromos?.filter(p => p.scope === 'item') || []

  // Validasi setiap item: harus ada, harus tersedia
  const validatedItems: {
    menu_item_id: string
    menu_item_name: string
    quantity: number
    unit_price: number
    subtotal: number
    package_choices?: Record<string, string>
  }[] = []

  // Hitung base subtotal (harga asli) untuk pengecekan min_purchase promo item
  let baseSubtotal = 0
  for (const reqItem of payload.items) {
    const menuItem = menuItems?.find((m) => m.id === reqItem.menu_item_id)
    if (menuItem) {
      baseSubtotal += menuItem.price * Number(reqItem.quantity)
    }
  }

  const appliedPromoIds = new Set<string>()

  let subtotalAmount = 0

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

    // Gunakan harga dari DATABASE dan hitung promo per item jika ada
    let unitPrice = calculateItemPrice(menuItem.price, menuItem.id, activePromos as BasePromo[], baseSubtotal)
    
    // Track applied promos
    if (unitPrice < menuItem.price) {
      let globalApplied = false
      if (globalPromo) {
        if (!(globalPromo.end_date && new Date(globalPromo.end_date).getTime() < Date.now()) && 
            !(globalPromo.usage_limit && (globalPromo.current_usage || 0) >= globalPromo.usage_limit)) {
          if (!globalPromo.min_purchase || (baseSubtotal >= globalPromo.min_purchase)) {
             globalApplied = true
             appliedPromoIds.add(globalPromo.id)
          }
        }
      }

      if (!globalApplied) {
        const itemPromo = itemPromos.find(p => p.menu_item_id === menuItem.id && p.is_active)
        if (itemPromo) {
          appliedPromoIds.add(itemPromo.id)
        }
      }
    }

    const subtotal = unitPrice * quantity

    subtotalAmount += subtotal
    
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
      package_choices: reqItem.package_choices
    })
  }

  const finalTotal = subtotalAmount

  // Buat order
  const { data: order, error: orderError } = await supabaseService
    .from('orders')
    .insert({
      outlet_id: outlet_id,
      customer_name: payload.customer_name || null,
      notes: null,
      payment_method: payload.payment_method,
      total_amount: finalTotal,
      discount_amount: null, // Global discount is now embedded in item unit prices
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

  // Increment usage for applied promos. RPC returns FALSE (bukan error) kalau
  // limit sudah terlampaui — order sudah terlanjur commit dengan diskon ini,
  // jadi tak bisa dibatalkan di titik ini; minimal matikan promonya supaya
  // tak terus dipakai melebihi limit, dan log keras untuk rekonsiliasi manual.
  if (appliedPromoIds.size > 0) {
    for (const promoId of Array.from(appliedPromoIds)) {
      const { data: incremented, error: incError } = await supabaseService.rpc('increment_promo_usage', { p_promo_id: promoId })
      if (incError) {
        console.error(`Gagal increment promo usage untuk ${promoId}:`, incError)
      } else if (incremented === false) {
        console.error(`[PROMO LIMIT EXCEEDED] Order ${order.id} pakai promo ${promoId} melebihi usage_limit — usage TIDAK bertambah, diskon SUDAH diterapkan di order ini. Perlu rekonsiliasi manual.`)
        await supabaseService.from('outlet_promos').update({ is_active: false }).eq('id', promoId)
      }
    }
  }

  return NextResponse.json({
    success: true,
    order_id: order.id,
    order_number: order.order_number,
    total_amount: finalTotal,
  })
}
