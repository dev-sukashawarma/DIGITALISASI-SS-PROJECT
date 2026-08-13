import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Dipanggil dari app/kasir saat kasir menekan "Tandai Selesai" pada order
// yang sumbernya online (source = 'online').
// Meneruskan notifikasi ke Edge Function `kasir-order-done` milik order-system
// (lihat scripts/setup-integration.js) yang mengirim WA "pesanan siap diambil"
// ke customer lewat Fonnte.
//
// Sebelumnya route ini menulis langsung ke DB order-system pakai
// NEXT_PUBLIC_SS_ORDER_URL + SS_ORDER_SERVICE_KEY — tapi SS_ORDER_SERVICE_KEY
// tidak pernah di-provision di Dockerfile/.env.example, jadi update ini SELALU
// gagal dengan 500 dan notifikasi WA tidak pernah terkirim. Env yang benar-benar
// dikonfigurasi (lihat Dockerfile) adalah ORDER_SYSTEM_NOTIFY_URL +
// KASIR_TO_ORDER_SECRET, yang dipakai di sini.
export async function POST(request: Request) {
  let body: { order_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  const { order_id } = body
  if (!order_id) {
    return NextResponse.json({ error: 'order_id wajib diisi' }, { status: 400 })
  }

  const supabaseService = createServiceClient()
  const { data: order } = await supabaseService
    .from('orders')
    .select('id, source, external_order_id')
    .eq('id', order_id)
    .single()

  if (!order || order.source !== 'online' || !order.external_order_id) {
    return NextResponse.json({ success: true, skipped: true })
  }

  const notifyUrl = process.env.ORDER_SYSTEM_NOTIFY_URL
  const secret = process.env.KASIR_TO_ORDER_SECRET

  if (!notifyUrl || !secret) {
    console.error('ORDER_SYSTEM_NOTIFY_URL / KASIR_TO_ORDER_SECRET belum dikonfigurasi')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  try {
    const res = await fetch(notifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        order_id: order.external_order_id,
        status: 'done',
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('order-system menolak notifikasi selesai:', res.status, errText)
      return NextResponse.json({ error: 'order-system menolak notifikasi' }, { status: 502 })
    }
  } catch (err) {
    console.error('Gagal menghubungi order-system:', err)
    return NextResponse.json({ error: 'Gagal menghubungi order-system' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
