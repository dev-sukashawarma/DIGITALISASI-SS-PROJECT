import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calculateItemPrice, calculateGlobalDiscount, calculateItemDiscount, BasePromo } from '@/lib/promo-calculator'

// Endpoint dipanggil dari halaman /kasir/order-manual (tab "Kasir Langsung")
// saat kasir mencatat pesanan pelanggan yang datang LANGSUNG ke kasir.
//
// Berbeda dari /api/orders/manual (channel eksternal):
// - tidak butuh `channel` (source 'pos', bukan channel online)
// - untuk pembayaran tunai, menghitung & menyimpan kembalian (jejak kas)
// - order langsung status 'preparing' (Sedang Diproses), sales_source 'pos'

interface WalkInItem {
  menu_item_id: string
  quantity: number
  note?: string
  parent_id?: string
  cartItemId?: string
  package_choices?: Record<string, string>
}

interface WalkInPayload {
  payment_method: 'cash' | 'qris' | 'card'
  customer_name?: string
  amount_received?: number // wajib untuk cash
  is_endorse?: boolean
  items: WalkInItem[]
  order_number?: number
}

export async function POST(request: Request) {
  let body: WalkInPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  // ── Validasi dasar ──────────────────────────────────────────────────────
  if (body.payment_method !== 'cash' && body.payment_method !== 'qris' && body.payment_method !== 'card') {
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
    .select('outlet_id, role, name')
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

  // ── Ambil promo aktif outlet ────────────────────────────────────────────
  const { data: activePromos } = await supabaseService
    .from('outlet_promos')
    .select('*')
    .eq('outlet_id', outlet_id)
    .eq('is_active', true)

  const globalPromo = activePromos?.find((p) => p.scope === 'global')
  const itemPromos = activePromos?.filter((p) => p.scope === 'item') || []

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
  for (const reqItem of body.items) {
    const menuItem = menuItems?.find((m) => m.id === reqItem.menu_item_id)
    if (menuItem) {
      baseSubtotal += menuItem.price * Number(reqItem.quantity)
    }
  }

  let total = 0
  // Diskon per-item dicatat supaya "Omzet Kotor" di laporan bisa direkonstruksi.
  // Order endorse dikecualikan (gratis-an bukan potongan penjualan).
  let itemDiscountTotal = 0

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

    let unitPrice = calculateItemPrice(menuItem.price, menuItem.id, activePromos as BasePromo[], baseSubtotal)
    if (body.is_endorse) {
      unitPrice = 0
    }

    const subtotal = unitPrice * quantity
    total += subtotal
    // Walk-in selalu channel POS (tanpa harga per-channel), acuannya harga menu.
    itemDiscountTotal += calculateItemDiscount(menuItem.price, unitPrice, quantity, {
      isGiveaway: body.is_endorse,
    })

    // Konvensi |NOTE|, |ID|, dan |PARENT| supaya hierarchy diparsing UI kasir & dapur
    const note = (reqItem.note ?? '').trim()
    let finalName = menuItem.name
    if (reqItem.cartItemId) {
      finalName += `|ID|${reqItem.cartItemId}`
    }
    if (reqItem.parent_id) {
      finalName += `|PARENT|${reqItem.parent_id}`
    }
    if (note) {
      finalName += `|NOTE|${note}`
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

  // ── Hitung Global Promo ─────────────────────────────────────────────────
  let globalDiscount = calculateGlobalDiscount(total, activePromos as BasePromo[])

  const finalTotal = total - globalDiscount
  
  // Track applied promos to increment usage limits
  const appliedPromoIds = new Set<string>()
  
  for (const item of validatedItems) {
    const menuItem = menuItems?.find(m => m.id === item.menu_item_id)
    if (menuItem && item.unit_price < menuItem.price) {
      // Find if it was global or item promo. In calculateItemPrice, global promo has priority.
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
        const itemPromo = itemPromos.find(p => p.menu_item_id === item.menu_item_id && p.is_active)
        if (itemPromo) {
          appliedPromoIds.add(itemPromo.id)
        }
      }
    }
  }

  // ── Validasi pembayaran tunai & hitung kembalian ────────────────────────
  let amountReceived: number | null = null
  let changeAmount: number | null = null
  if (body.payment_method === 'cash') {
    amountReceived = Number(body.amount_received)
    if (!Number.isFinite(amountReceived) || amountReceived < finalTotal) {
      return NextResponse.json({ error: 'Uang diterima kurang dari total' }, { status: 400 })
    }
    changeAmount = amountReceived - finalTotal
  }

  // ── Buat order langsung status 'preparing' (Diproses) ───────────────────
  const customerName = (body.customer_name ?? '').trim()
  const recordedDiscount = globalDiscount + itemDiscountTotal

  const baseOrder = {
    outlet_id,
    customer_name: customerName || null,
    cashier_name: profile.name || null,
    payment_method: body.payment_method,
    total_amount: finalTotal,
    // Diskon tercatat = global (kini selalu 0) + promo per-item. Hanya untuk
    // laporan; total tagihan tidak berubah (harga sudah didiskon di unit_price).
    discount_amount: recordedDiscount > 0 ? recordedDiscount : null,
    status: 'preparing',
    kitchen_receipt_printed: true,
    source: 'pos',
    channel: null,
    sales_source: 'pos',
    order_number: body.order_number,
  }

  // Kolom audit kas (amount_received/change_amount) ditambahkan lewat migrasi
  // aditif. Bila belum di-apply, insert di-retry tanpa kolom tersebut agar
  // fitur tetap jalan (kembalian tetap dihitung & dikembalikan ke UI/struk).
  let order: { id: string; order_number: number } | null = null
  let orderError: { code?: string; message?: string } | null = null

  {
    const res = await supabaseService
      .from('orders')
      .insert({ ...baseOrder, amount_received: amountReceived, change_amount: changeAmount })
      .select('id, order_number')
      .single()
    order = res.data
    orderError = res.error
  }

  // 42703 = undefined_column (Postgres); PGRST204 = kolom tak dikenal (PostgREST)
  const missingColumn =
    orderError && (orderError.code === '42703' || orderError.code === 'PGRST204' ||
      /amount_received|change_amount/i.test(orderError.message ?? ''))

  if (missingColumn) {
    console.warn('Kolom audit kas belum ada, insert tanpa amount_received/change_amount. Jalankan migration-walkin-payment.sql.')
    const res = await supabaseService
      .from('orders')
      .insert(baseOrder)
      .select('id, order_number')
      .single()
    order = res.data
    orderError = res.error
  }

  if (orderError || !order) {
    console.error('Gagal membuat order walk-in:', orderError)
    return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 500 })
  }

  const { error: itemsError } = await supabaseService.from('order_items').insert(
    validatedItems.map((item) => ({ ...item, order_id: order.id }))
  )

  if (itemsError) {
    console.error('Gagal menyimpan item order walk-in:', itemsError)
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
    discount_amount: globalDiscount,
    amount_received: amountReceived,
    change_amount: changeAmount,
  })
}
