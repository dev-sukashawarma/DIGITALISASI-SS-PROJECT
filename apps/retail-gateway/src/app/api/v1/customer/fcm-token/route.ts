import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createRetailClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: {
    fcm_token?: string
    device_info?: string
    notify_order_status?: boolean
    notify_promotions?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  if (!body.fcm_token || typeof body.fcm_token !== 'string' || body.fcm_token.trim().length === 0) {
    return NextResponse.json({ error: 'fcm_token wajib diisi' }, { status: 400 })
  }

  const retail = createRetailClient()

  const { error } = await retail
    .from('customer_push_tokens')
    .upsert(
      {
        customer_id: sesi.customerId,
        fcm_token: body.fcm_token.trim(),
        device_info: body.device_info ?? null,
        notify_order_status: body.notify_order_status ?? true,
        notify_promotions: body.notify_promotions ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fcm_token' }
    )

  if (error) {
    console.error('Gagal menyimpan fcm_token:', error)
    return NextResponse.json({ error: 'Gagal mendaftarkan token push' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
