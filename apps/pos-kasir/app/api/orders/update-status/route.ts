import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Perbandingan constant-time untuk cegah timing attack pada token comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// Endpoint dipanggil oleh order-system (Edge Function sync-status-to-pos)
// saat order diselesaikan ('done') atau dibatalkan ('cancelled').
export async function POST(request: Request) {
  const incomingToken = request.headers.get('x-internal-token') ?? ''
  const expectedToken = process.env.ORDER_TO_KASIR_SECRET

  if (!expectedToken) {
    console.error('ORDER_TO_KASIR_SECRET belum dikonfigurasi')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  if (!incomingToken || !timingSafeEqual(incomingToken, expectedToken)) {
    console.error('Token order-system tidak valid')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { external_order_id: string; status: 'completed' | 'cancelled' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  const { external_order_id, status } = body

  if (!external_order_id || !status) {
    return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
  }

  if (status !== 'completed' && status !== 'cancelled') {
    return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
  }

  const supabaseService = createServiceClient()

  // Cari order berdasarkan external_order_id
  const { data: order, error: findError } = await supabaseService
    .from('orders')
    .select('id, status')
    .eq('external_order_id', external_order_id)
    .maybeSingle()

  if (findError) {
    console.error('Gagal mencari order:', findError)
    return NextResponse.json({ error: 'Gagal mencari order' }, { status: 500 })
  }

  if (!order) {
    console.error('Order tidak ditemukan untuk external_order_id:', external_order_id)
    return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 })
  }

  // Idempoten: Jika status sudah sesuai, langsung return success
  if (order.status === status) {
    return NextResponse.json({ success: true, message: 'Status sudah sesuai (idempoten)' })
  }

  // Update status order di database POS
  const { error: updateError } = await supabaseService
    .from('orders')
    .update({ status })
    .eq('id', order.id)

  if (updateError) {
    console.error('Gagal update status order:', updateError)
    return NextResponse.json({ error: 'Gagal update status order' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: `Status order berhasil di-update ke ${status}` })
}
