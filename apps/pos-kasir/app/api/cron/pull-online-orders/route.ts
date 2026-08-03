import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient as createOrderClient } from '@supabase/supabase-js'

// Menarik pesanan online yang sudah dibayar ke POS Kasir dari sisi SERVER.
//
// Sebelumnya ingest hanya jalan lewat OnlineOrderSync di browser, jadi pesanan
// tidak masuk sama sekali kalau tab kasir tertutup atau outlet sedang offline.
// Route ini membuat ingest tidak lagi bergantung pada perangkat di outlet.

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL
  const SS_ORDER_KEY = process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY
  if (!SS_ORDER_URL || !SS_ORDER_KEY) {
    return NextResponse.json({ error: 'Kredensial SS_ORDER tidak dikonfigurasi' }, { status: 500 })
  }

  const ssOrderDb = createOrderClient(SS_ORDER_URL, SS_ORDER_KEY)
  const posDb = createServiceClient()

  // Jendela 3 hari: cukup lebar untuk menutup outlet yang offline semalaman,
  // cukup sempit supaya cron per menit tetap ringan.
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: paidOrders, error: paidErr } = await ssOrderDb
    .from('orders')
    .select('id')
    .eq('status', 'paid')
    .gte('created_at', since)

  if (paidErr) {
    console.error('pull-online-orders: gagal baca order-system', paidErr)
    return NextResponse.json({ error: paidErr.message }, { status: 500 })
  }
  if (!paidOrders || paidOrders.length === 0) {
    return NextResponse.json({ success: true, pulled: 0, skipped: 0 })
  }

  // Anti-join: mana yang BELUM punya pasangan di pos-kasir.
  // Menggantikan limit(10) lama yang membuat order lama terlewat permanen.
  const ids = paidOrders.map((o) => o.id)
  const { data: alreadyPulled } = await posDb
    .from('orders')
    .select('external_order_id')
    .in('external_order_id', ids)

  const pulledSet = new Set((alreadyPulled ?? []).map((r) => r.external_order_id))
  const missing = ids.filter((id) => !pulledSet.has(id))

  const origin = new URL(request.url).origin
  let pulled = 0

  for (const externalId of missing) {
    try {
      const res = await fetch(`${origin}/api/orders/pull-online`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_order_id: externalId }),
      })
      if (res.ok) {
        pulled += 1
      } else {
        const detail = await res.json().catch(() => ({} as any))
        console.warn(`pull-online-orders: gagal tarik ${externalId}`, detail.error)
      }
    } catch (err) {
      console.warn(`pull-online-orders: error saat tarik ${externalId}`, err)
    }
  }

  return NextResponse.json({
    success: true,
    pulled,
    skipped: ids.length - missing.length,
  })
}
