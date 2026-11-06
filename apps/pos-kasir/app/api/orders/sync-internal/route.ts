import { NextResponse } from 'next/server'
import { createClient as createOrderClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { requirePosCaller } from '@/lib/posApiGate'
import { isValidExternalOrderId, mapRemoteStatus } from '@/lib/onlineOrderRules'

// Dipanggil OnlineOrderSync saat event realtime order-system berubah ke
// done/ready/cancelled.
//
// Pengamanan (2026-11-06): dulu route ini tanpa login, mencocokkan id ke
// `orders.id` ATAU `external_order_id`, dan memakai `status` kiriman client
// apa adanya — siapa pun bisa membatalkan order kasir mana pun hanya dengan
// id-nya. Kini: wajib staf POS, hanya order website (`external_order_id`), dan
// status DIBACA ULANG dari order-system; `status` di body diabaikan.
export async function POST(request: Request) {
  const caller = await requirePosCaller(request)
  if (caller instanceof NextResponse) return caller

  try {
    const { external_order_id } = await request.json()
    if (!isValidExternalOrderId(external_order_id)) {
      return NextResponse.json({ error: 'external_order_id tidak valid' }, { status: 400 })
    }

    const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL
    const SS_ORDER_KEY = process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY
    if (!SS_ORDER_URL || !SS_ORDER_KEY) {
      return NextResponse.json({ error: 'Kredensial SS_ORDER tidak dikonfigurasi' }, { status: 500 })
    }

    const { data: remote, error: remoteErr } = await createOrderClient(SS_ORDER_URL, SS_ORDER_KEY)
      .from('orders')
      .select('id, status')
      .eq('id', external_order_id)
      .maybeSingle()
    if (remoteErr) {
      console.error('API sync-internal: gagal baca order-system', remoteErr)
      return NextResponse.json({ error: 'Gagal membaca order-system' }, { status: 502 })
    }

    const status = mapRemoteStatus(remote?.status)
    if (!status) {
      return NextResponse.json({ success: true, message: 'Tidak ada perubahan status' })
    }

    const posDb = createServiceClient()
    const { data: orderList } = await posDb
      .from('orders')
      .select('id, status')
      .eq('external_order_id', external_order_id)
      .limit(1)

    const order = orderList && orderList.length > 0 ? orderList[0] : null
    if (!order) {
      return NextResponse.json({ success: true, message: 'Not found locally' })
    }

    if (order.status !== status) {
      const { error: updateErr } = await posDb
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', order.id)

      if (updateErr) {
        console.error('API sync-internal update error:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('API sync-internal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
