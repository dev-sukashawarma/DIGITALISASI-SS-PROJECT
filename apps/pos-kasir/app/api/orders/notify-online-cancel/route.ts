import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Dipanggil dari app/kasir saat kasir membatalkan order (cancelOrder)
// yang sumbernya online (source = 'online').
// Meneruskan notifikasi ke Edge Function order-system (lihat komentar di
// notify-online-done/route.ts untuk kenapa route ini pindah dari update DB
// langsung ke webhook ORDER_SYSTEM_NOTIFY_URL, dan untuk detail bug
// header/body yang sama juga ada di sini sebelum diperbaiki).
//
// Bug ketiga, khusus route ini: ORDER_SYSTEM_NOTIFY_URL selalu menunjuk ke
// edge function `kasir-order-done` (lihat scripts/setup-integration.js), jadi
// pembatalan order SELALU memanggil edge function "selesai", bukan
// `kasir-order-cancel` — order yang dibatalkan malah akan dicoba di-set ke
// status 'ready', bukan 'cancelled'. Diperbaiki dengan menurunkan URL cancel
// dari notifyUrl (ganti akhiran nama fungsinya), dengan opsi override lewat
// ORDER_SYSTEM_CANCEL_URL kalau suatu saat mau dikonfigurasi terpisah.
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

  const doneUrl = process.env.ORDER_SYSTEM_NOTIFY_URL
  const secret = process.env.KASIR_TO_ORDER_SECRET
  const notifyUrl = process.env.ORDER_SYSTEM_CANCEL_URL || doneUrl?.replace('kasir-order-done', 'kasir-order-cancel')

  if (!notifyUrl || !secret) {
    console.error('ORDER_SYSTEM_NOTIFY_URL / KASIR_TO_ORDER_SECRET belum dikonfigurasi')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  try {
    const res = await fetch(notifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': secret,
      },
      body: JSON.stringify({
        external_order_id: order.external_order_id,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('order-system menolak notifikasi batal:', res.status, errText)
      return NextResponse.json({ error: 'order-system menolak notifikasi' }, { status: 502 })
    }
  } catch (err) {
    console.error('Gagal menghubungi order-system:', err)
    return NextResponse.json({ error: 'Gagal menghubungi order-system' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
