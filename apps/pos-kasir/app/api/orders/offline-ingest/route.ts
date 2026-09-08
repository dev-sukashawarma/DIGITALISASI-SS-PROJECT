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

function normalizeCustomerName(str?: string | null): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .trim()
    .replace(/^(ka|kak|pa|pak|bu|ibu|mas|mbak)\s+/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim()
}

function isFuzzyNameMatch(a?: string | null, b?: string | null): boolean {
  const normA = normalizeCustomerName(a)
  const normB = normalizeCustomerName(b)
  if (!normA || !normB) return false
  if (normA === normB) return true
  // Substring matching untuk nama dengan panjang minimal 4 karakter (misal: 'dongki' vs 'dongkil')
  if (normA.length >= 4 && normB.length >= 4 && (normA.includes(normB) || normB.includes(normA))) {
    return true
  }
  // Toleransi 1 karakter typo (Levenshtein distance <= 1)
  if (Math.abs(normA.length - normB.length) <= 1 && normA.length >= 4 && normB.length >= 4) {
    let diffs = 0
    let i = 0, j = 0
    while (i < normA.length && j < normB.length) {
      if (normA[i] !== normB[j]) {
        diffs++
        if (diffs > 1) return false
        if (normA.length > normB.length) i++
        else if (normB.length > normA.length) j++
        else { i++; j++ }
      } else {
        i++; j++
      }
    }
    return true
  }
  return false
}

function areItemsSimilar(
  itemsA?: Array<{ menu_item_name?: string; quantity: number }> | null,
  itemsB?: Array<{ menu_item_name?: string; quantity: number }> | null
): boolean {
  if (!itemsA || !itemsB || itemsA.length === 0 || itemsB.length === 0) return false
  if (itemsA.length !== itemsB.length) return false

  const cleanItemName = (name?: string) => (name || '').split('|NOTE|')[0].toLowerCase().trim()

  const sortedA = [...itemsA].sort((x, y) => cleanItemName(x.menu_item_name).localeCompare(cleanItemName(y.menu_item_name)))
  const sortedB = [...itemsB].sort((x, y) => cleanItemName(x.menu_item_name).localeCompare(cleanItemName(y.menu_item_name)))

  return sortedA.every((itA, idx) => {
    const itB = sortedB[idx]
    return cleanItemName(itA.menu_item_name) === cleanItemName(itB.menu_item_name) && itA.quantity === itB.quantity
  })
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

  // ── Soft-match & Idempotent Deduplication ──────────────────────────────────
  // Jika order sudah dimasukkan lebih dulu (melalui Web POS, online webhook,
  // atau sinkronisasi lain) sebelum proses upload offline ini tiba.
  // Window waktu: ±6 jam dari waktu transaksi asli (body.created_at).
  const orderCreatedAt = new Date(body.created_at)
  const windowStart = new Date(orderCreatedAt.getTime() - 6 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(orderCreatedAt.getTime() + 6 * 60 * 60 * 1000).toISOString()

  const { data: candidateOrders } = await supabaseService
    .from('orders')
    .select(`
      id,
      order_number,
      client_order_id,
      customer_name,
      total_amount,
      status,
      payment_method,
      created_at,
      order_items (
        menu_item_name,
        quantity,
        subtotal
      )
    `)
    .eq('outlet_id', outletId)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .neq('status', 'cancelled')

  if (candidateOrders && candidateOrders.length > 0) {
    const matched = candidateOrders.find((cand: any) => {
      // 1. Cek kecocokan nominal (identik, atau toleransi diskon promo merdeka s/d 5.000)
      const amountDiff = Math.abs(cand.total_amount - body.total_amount)
      const isAmountExact = amountDiff === 0
      const isAmountPromoClose = amountDiff <= 5000

      // 2. Cek kecocokan nama pembeli
      const isNameMatch = isFuzzyNameMatch(cand.customer_name, body.customer_name)

      // 3. Cek kecocokan daftar item
      const isItemMatch = areItemsSimilar(cand.order_items, body.items)

      // Kriteria duplikat:
      // a. Nominal sama persis DAN (nama mirip ATAU item mirip)
      if (isAmountExact && (isNameMatch || isItemMatch)) return true

      // b. Jika nominal selisih promo <= 5000, WAJIB nama mirip DAN item mirip
      if (isAmountPromoClose && isNameMatch && isItemMatch) return true

      return false
    })

    if (matched) {
      if (!matched.client_order_id) {
        await supabaseService
          .from('orders')
          .update({ client_order_id: body.client_order_id })
          .eq('id', matched.id)

        console.log(`offline-ingest: Soft-match berhasil ditautkan, update client_order_id untuk order #${matched.order_number} (${matched.id})`)
      } else {
        console.log(`offline-ingest: Order duplikat terdeteksi cocok dengan #${matched.order_number} (${matched.id})`)
      }

      return NextResponse.json({
        success: true,
        duplicate: true,
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
    updated_at: body.created_at,
  }

  // Buat order dan items secara atomic
  const { data: order, error: orderError } = await supabaseService.rpc('atomic_insert_order', {
    p_order: fullPayload,
    p_items: body.items.map((it) => ({
      menu_item_id: it.menu_item_id,
      menu_item_name: it.menu_item_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      subtotal: it.subtotal,
      package_choices: it.package_choices ?? null,
    }))
  })

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

  return NextResponse.json({
    success: true,
    order_id: order.id,
    order_number: order.order_number,
  })
}
