import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateReleaseTime, calculateTotalPrepTime, parsePickupTime } from '@/lib/prepTime'
import { buildMenuNameIndex, resolveMenuItemId } from '@/lib/resolve-menu-id'
import { isPullableRemoteStatus, isValidExternalOrderId } from '@/lib/onlineOrderRules'

export type PullResult = { status: number; body: Record<string, unknown> }

/**
 * Tarik satu pesanan website (order-system) ke tabel `orders` POS.
 * Dipakai route `/api/orders/pull-online` (browser kasir) dan cron server
 * `/api/cron/pull-online-orders` — cron memanggil fungsi ini langsung, bukan
 * lewat HTTP, sehingga tidak butuh rahasia tambahan.
 *
 * Pengamanan (2026-11-06):
 *  - idempotensi HANYA lewat `external_order_id`. Dulu id juga dicocokkan ke
 *    `orders.id`, dan kalau ketemu order kasir biasa, order itu diubah jadi
 *    `online` — siapa pun bisa memindahkan omzet kasir ke kanal Website.
 *  - order di order-system wajib sudah dibayar; order `pending`/`expired`
 *    dulu tetap bisa ditarik dan menjadi omzet tanpa uang.
 */
export async function pullOnlineOrder(externalOrderId: unknown): Promise<PullResult> {
  if (!isValidExternalOrderId(externalOrderId)) {
    return { status: 400, body: { error: 'external_order_id tidak valid' } }
  }
  const external_order_id = externalOrderId

  const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL
  const SS_ORDER_KEY = process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY
  if (!SS_ORDER_URL || !SS_ORDER_KEY) {
    return { status: 500, body: { error: 'Kredensial SS_ORDER tidak dikonfigurasi' } }
  }

  const ssOrderDb = createClient(SS_ORDER_URL, SS_ORDER_KEY)
  const posDb = createServiceClient()

  // 1. Idempotensi: sudah pernah ditarik?
  const { data: existingList } = await posDb
    .from('orders')
    .select('id, order_number')
    .eq('external_order_id', external_order_id)
    .limit(1)
  if (existingList && existingList.length > 0) {
    return {
      status: 200,
      body: { success: true, message: 'Order sudah ditarik sebelumnya', order_id: existingList[0].id, order_number: existingList[0].order_number },
    }
  }

  // 2. Ambil data order dari order-system
  const { data: order, error: orderErr } = await ssOrderDb
    .from('orders')
    .select(`
      id, status, customer_name, customer_wa, total, notes, outlet_id, pickup_time,
      outlets!inner(pos_outlet_id),
      order_items(item_name, quantity, unit_price, note)
    `)
    .eq('id', external_order_id)
    .single()

  if (orderErr || !order) {
    return { status: 404, body: { error: 'Order tidak ditemukan di SS_ORDER' } }
  }
  if (!isPullableRemoteStatus(order.status)) {
    return { status: 409, body: { error: `Order belum dibayar (status ${order.status ?? '-'})` } }
  }

  const posOutletId = Array.isArray(order.outlets)
    ? (order.outlets[0] as any)?.pos_outlet_id
    : (order.outlets as any)?.pos_outlet_id
  if (!posOutletId) {
    return { status: 400, body: { error: 'Outlet belum dipetakan ke POS Kasir (pos_outlet_id kosong)' } }
  }

  // Soft-match: kasir kadang menginput manual lebih dulu. Cari order outlet yang
  // sama, nama & total sama, < 1 jam, belum punya external_order_id.
  const timeLimit = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: softMatchList } = await posDb
    .from('orders')
    .select('id, order_number')
    .eq('outlet_id', posOutletId)
    .eq('customer_name', order.customer_name)
    .eq('total_amount', order.total)
    .is('external_order_id', null)
    .gte('created_at', timeLimit)
    .limit(1)

  if (softMatchList && softMatchList.length > 0) {
    const match = softMatchList[0]
    console.log(`Soft-match (pull-online) berhasil untuk order: ${match.id}`)
    await posDb
      .from('orders')
      .update({ source: 'online', sales_source: 'online', external_order_id, updated_at: new Date().toISOString() })
      .eq('id', match.id)
      .is('external_order_id', null)
    return {
      status: 200,
      body: { success: true, message: 'Order sudah ditarik sebelumnya (via soft-match)', order_id: match.id, order_number: match.order_number },
    }
  }

  const pickupTime = parsePickupTime(order.pickup_time)
  let releaseTime = null
  if (pickupTime) {
    const itemsForPrep = order.order_items?.map((i: any) => ({ quantity: i.quantity, prep_time: 10 })) || []
    releaseTime = calculateReleaseTime(pickupTime, calculateTotalPrepTime(itemsForPrep))
  }

  // 3. Masukkan ke POS. Dipanggil bersamaan dari beberapa jalur (cron, browser
  // kasir), jadi idempotensi akhirnya di DB lewat ON CONFLICT DO NOTHING.
  const { data: newOrder, error: insertErr } = await posDb
    .from('orders')
    .upsert(
      {
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
      },
      { onConflict: 'external_order_id', ignoreDuplicates: true }
    )
    .select('id, order_number')
    .maybeSingle()

  if (insertErr) {
    console.error('Gagal insert order ke pos-kasir:', insertErr)
    return { status: 500, body: { error: 'Gagal menyimpan pesanan ke database kasir' } }
  }

  if (!newOrder) {
    const { data: retryList } = await posDb
      .from('orders')
      .select('id, order_number')
      .eq('external_order_id', external_order_id)
      .limit(1)
    if (retryList && retryList.length > 0) {
      return {
        status: 200,
        body: { success: true, message: 'Order sudah ditarik sebelumnya (race condition resolved)', order_id: retryList[0].id, order_number: retryList[0].order_number },
      }
    }
    console.error('Upsert order tidak mengembalikan baris dan tidak ditemukan:', external_order_id)
    return { status: 500, body: { error: 'Gagal menyimpan pesanan ke database kasir' } }
  }

  // 4. Item. Nama menu dicocokkan ke menu_items POS (database order-system
  // memakai id menu sendiri) supaya BOM & HPP jalan.
  const items = order.order_items || []
  if (items.length > 0) {
    const { data: menuRows } = await posDb.from('menu_items').select('id, name')
    const menuIndex = buildMenuNameIndex(menuRows)
    const { error: itemsErr } = await posDb.from('order_items').insert(
      items.map((i: any) => ({
        order_id: newOrder.id,
        menu_item_id: resolveMenuItemId(menuIndex, i.item_name),
        menu_item_name: i.note ? `${i.item_name}|NOTE|${i.note}` : i.item_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.unit_price * i.quantity,
      }))
    )
    if (itemsErr) console.error('Gagal insert order items:', itemsErr)
  }

  return { status: 200, body: { success: true, order_id: newOrder.id, order_number: newOrder.order_number } }
}
