import { NextResponse } from 'next/server'
import { createServiceClient, createRetailClient } from '@/lib/supabase'
import { bacaStatusWebhook, rahasiaCocok } from '@/lib/xendit'
import { susunPayloadPos } from '@/lib/orderPayload'
import type { ItemPesanan } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Token diperiksa PALING AWAL, sebelum apa pun dibaca dari payload.
  // Memeriksanya belakangan membuat endpoint jadi oracle yang membocorkan
  // keberadaan pesanan kepada pemanggil yang tidak berhak.
  const token = request.headers.get('x-callback-token')
  const diharapkan = process.env.XENDIT_WEBHOOK_TOKEN
  // Perbandingan tahan-waktu, bukan `!==`. Lihat catatan di `rahasiaCocok`.
  if (!diharapkan || !rahasiaCocok(token, diharapkan)) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 })
  }

  const peristiwa = bacaStatusWebhook(payload)
  if (!peristiwa) {
    // Status yang tidak final: akui saja supaya Xendit tidak mengirim ulang.
    return NextResponse.json({ diabaikan: true })
  }

  const retail = createRetailClient()
  const { data: draft } = await retail
    .from('order_drafts')
    .select('id, client_order_id, customer_id, outlet_id, items, subtotal, discount_amount, total_amount, pickup_code, status, pos_order_id')
    .eq('client_order_id', peristiwa.externalId)
    .maybeSingle()

  if (!draft) {
    console.error('Webhook untuk pesanan yang tidak dikenal:', peristiwa.externalId)
    return NextResponse.json({ diabaikan: true })
  }

  if (peristiwa.status === 'gagal') {
    if (draft.status === 'menunggu_bayar') {
      await retail.from('order_drafts').update({ status: 'gagal' }).eq('id', draft.id)
    }
    return NextResponse.json({ ok: true })
  }

  // Sudah pernah didorong ke kasir. Webhook kembar itu lumrah -- abaikan,
  // jangan membuat pesanan kedua.
  if (draft.pos_order_id) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  const { data: pelanggan } = await retail
    .from('customers')
    .select('name, phone')
    .eq('id', draft.customer_id)
    .maybeSingle()

  const { p_order, p_items } = susunPayloadPos({
    clientOrderId: draft.client_order_id,
    outletId: draft.outlet_id,
    customerName: pelanggan?.name ?? 'Pelanggan Aplikasi',
    customerPhone: pelanggan?.phone ?? null,
    items: draft.items as ItemPesanan[],
    subtotal: Number(draft.subtotal),
    discountAmount: Number(draft.discount_amount),
    total: Number(draft.total_amount),
    pickupCode: draft.pickup_code,
  })

  const db = createServiceClient()
  const { data: hasil, error } = await db.rpc('atomic_insert_order', {
    p_order,
    p_items,
  })

  if (error) {
    // 23505 pada client_order_id: percobaan kembar sudah menang duluan.
    if ((error as { code?: string }).code === '23505') {
      const { data: pemenang } = await db
        .from('orders')
        .select('id, order_number')
        .eq('client_order_id', draft.client_order_id)
        .maybeSingle()
      if (pemenang) {
        await retail
          .from('order_drafts')
          .update({
            status: 'dibayar',
            paid_at: new Date().toISOString(),
            pos_order_id: pemenang.id,
            pos_order_number: pemenang.order_number,
          })
          .eq('id', draft.id)
        return NextResponse.json({ ok: true, duplicate: true })
      }
    }

    // Uang pelanggan sudah masuk tapi pesanan gagal sampai ke kasir.
    // Ini WAJIB terlihat, bukan ditelan diam-diam.
    console.error('GAGAL DORONG PESANAN BERBAYAR KE KASIR', {
      client_order_id: draft.client_order_id,
      error,
    })
    return NextResponse.json({ error: 'Gagal meneruskan ke kasir' }, { status: 500 })
  }

  const posOrder = hasil as { id: string; order_number: number }

  await db
    .from('orders')
    .update({ pickup_code: draft.pickup_code })
    .eq('id', posOrder.id)

  await retail
    .from('order_drafts')
    .update({
      status: 'dibayar',
      paid_at: new Date().toISOString(),
      pos_order_id: posOrder.id,
      pos_order_number: posOrder.order_number,
    })
    .eq('id', draft.id)

  return NextResponse.json({ ok: true, order_number: posOrder.order_number })
}
