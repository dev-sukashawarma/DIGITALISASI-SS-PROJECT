import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import webpush from 'web-push'

// Configure web-push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@sukashawarma.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function GET(request: Request) {
  try {
    // Verifikasi cron secret jika pakai Vercel Cron
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Allow bypass for local testing if no secret set
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const supabase = createServiceClient()

    // 1. Ambil order yang statusnya scheduled dan pending/preparing
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, outlet_id, status, notes, order_type, pickup_time, created_at, receipt_number')
      .eq('order_type', 'scheduled')
      .in('status', ['pending', 'preparing'])

    if (orderError) throw orderError

    // 2. Ambil semua push subscriptions untuk kasir
    const { data: subs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id, outlet_id')
      .eq('app', 'pos-kasir')

    if (subError) throw subError

    const now = Date.now()
    const oneMinute = 60 * 1000

    // Simpan promises push notifikasi agar dikirim paralel
    const pushPromises: Promise<any>[] = []

    for (const order of orders) {
      let timeStr = (order as any).pickup_time
      if (!timeStr && order.notes && order.notes.toUpperCase().includes('AMBIL')) {
        const match = order.notes.match(/AMBIL\s*[:\n]\s*(\d{2}:\d{2})/i)
        if (match) timeStr = match[1]
      }
      
      if (timeStr && typeof timeStr === 'string') {
        const timeMatch = timeStr.match(/(\d{2}):(\d{2})/)
        if (timeMatch) {
          const [_, h, m] = timeMatch
          const d = new Date()
          d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0)
          if (d.getTime() < new Date(order.created_at).getTime()) {
            d.setDate(d.getDate() + 1)
          }
          
          const urgentTime = d.getTime() - (10 * 60 * 1000)
          
          // Jika waktu urgent baru saja lewat dalam 1 menit terakhir
          // (atau 2 menit untuk toleransi delay cron)
          if (now >= urgentTime && now < urgentTime + (2 * oneMinute)) {
            // Temukan subscription untuk outlet order ini
            const outletSubs = subs.filter(s => s.outlet_id === order.outlet_id)
            
            for (const sub of outletSubs) {
              const payload = JSON.stringify({
                title: 'PERINGATAN PESANAN!',
                body: `Pesanan ${order.receipt_number || 'Terjadwal'} sisa 10 menit! Segera siapkan!`,
                icon: '/icon-512x512.png',
                data: {
                  url: '/kasir'
                }
              })

              const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth
                }
              }

              pushPromises.push(
                webpush.sendNotification(pushSubscription, payload).catch(async (err) => {
                  if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription expired/removed, delete from DB
                    console.log('Subscription expired, deleting endpoint:', sub.endpoint)
                    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
                  } else {
                    console.error('Push error:', err)
                  }
                })
              )
            }
          }
        }
      }
    }

    await Promise.all(pushPromises)

    return NextResponse.json({ success: true, pushed: pushPromises.length })
  } catch (err: any) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
