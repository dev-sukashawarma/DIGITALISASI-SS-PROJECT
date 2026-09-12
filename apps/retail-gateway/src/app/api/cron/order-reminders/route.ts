import { NextResponse } from 'next/server'
import { createRetailClient, createServiceClient } from '@/lib/supabase'
import { insertCustomerNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Cron authorization
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 })
  }

  const retail = createRetailClient()
  const db = createServiceClient()

  // Ambil draft yang sudah dibayar dalam 6 jam terakhir
  const enamJamLalu = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  const tigaPuluhMenitLalu = new Date(Date.now() - 30 * 60 * 1000).getTime()

  const { data: drafts } = await retail
    .from('order_drafts')
    .select('id, customer_id, outlet_id, pos_order_id, pos_order_number, paid_at')
    .eq('status', 'dibayar')
    .not('pos_order_id', 'is', null)
    .gte('paid_at', enamJamLalu)

  if (!drafts || drafts.length === 0) {
    return NextResponse.json({ checked: 0, reminders_sent: 0 })
  }

  let sentCount = 0

  for (const draft of drafts) {
    // Periksa status POS di tabel orders
    const { data: pos } = await db
      .from('orders')
      .select('status')
      .eq('id', draft.pos_order_id)
      .maybeSingle()

    // Jika pesanan siap diambil tapi lewat dari 30 menit sejak dibayar
    if (pos?.status === 'ready' && draft.paid_at && new Date(draft.paid_at).getTime() < tigaPuluhMenitLalu) {
      // Periksa apakah pengingat sudah pernah dikirim
      const { data: existing } = await retail
        .from('customer_notifications')
        .select('id')
        .eq('order_id', draft.id)
        .eq('type', 'reminder')
        .maybeSingle()

      if (!existing) {
        const orderNum = draft.pos_order_number ? `#${draft.pos_order_number}` : ''
        await insertCustomerNotification(retail, {
          customerId: draft.customer_id,
          orderId: draft.id,
          type: 'reminder',
          title: 'Pengingat Pengambilan ⏰',
          body: `Pesanan ${orderNum} sudah siap diambil lebih dari 30 menit. Silakan ambil di kasir agar tetap nikmat!`,
          data: {
            order_id: draft.id,
            status: 'ready',
            reminder_type: '30_min',
          },
        })
        sentCount++
      }
    }
  }

  return NextResponse.json({ checked: drafts.length, reminders_sent: sentCount })
}
