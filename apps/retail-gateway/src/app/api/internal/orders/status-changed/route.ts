import { NextResponse } from 'next/server'
import { createRetailClient, createServiceClient } from '@/lib/supabase'
import { insertCustomerNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // S2S secret check
  const secret = request.headers.get('x-internal-secret')
  const expected = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 })
  }

  let body: {
    order_id?: string
    status?: string
    order_number?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  if (!body.order_id || !body.status) {
    return NextResponse.json({ error: 'order_id dan status wajib diisi' }, { status: 400 })
  }

  const retail = createRetailClient()

  // Cari draft pesanan yang berelasi dengan pos_order_id atau id draft
  const { data: draft } = await retail
    .from('order_drafts')
    .select('id, customer_id, outlet_id, pos_order_number')
    .or(`pos_order_id.eq.${body.order_id},id.eq.${body.order_id}`)
    .maybeSingle()

  if (!draft) {
    // Bukan pesanan aplikasi retail, abaikan tanpa galat
    return NextResponse.json({ skipped: true, reason: 'Bukan pesanan retail' })
  }

  const orderNum = body.order_number ?? draft.pos_order_number ?? ''
  let title = 'Status Pesanan Diperbarui'
  let text = `Status pesanan #${orderNum} telah diperbarui.`
  let type: 'order_status' | 'reminder' = 'order_status'

  switch (body.status) {
    case 'preparing':
      title = 'Sedang Disiapkan 👨‍🍳'
      text = `Pesanan #${orderNum} sedang disiapkan oleh kru dapur.`
      break
    case 'ready':
      title = 'Pesanan Siap Diambil! 🌯'
      text = `Pesanan #${orderNum} sudah selesai dimasak dan siap diambil di kasir.`
      break
    case 'completed':
      title = 'Pesanan Selesai ✅'
      text = `Pesanan #${orderNum} telah diambil. Selamat menikmati hidangan Suka Shawarma!`
      break
    case 'cancelled':
      title = 'Pesanan Dibatalkan ❌'
      text = `Pesanan #${orderNum} telah dibatalkan.`
      break
  }

  await insertCustomerNotification(retail, {
    customerId: draft.customer_id,
    orderId: draft.id,
    type,
    title,
    body: text,
    data: {
      order_id: draft.id,
      status: body.status,
      order_number: orderNum,
    },
  })

  return NextResponse.json({ success: true, customer_id: draft.customer_id })
}
