import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createRetailClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  const retail = createRetailClient()

  // Ambil preferensi terbaru dari perangkat yang terdaftar
  const { data: pref } = await retail
    .from('customer_push_tokens')
    .select('notify_order_status, notify_promotions')
    .eq('customer_id', sesi.customerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    notify_order_status: pref?.notify_order_status ?? true,
    notify_promotions: pref?.notify_promotions ?? true,
  })
}

export async function PATCH(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: {
    notify_order_status?: boolean
    notify_promotions?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (typeof body.notify_order_status === 'boolean') {
    patch.notify_order_status = body.notify_order_status
  }
  if (typeof body.notify_promotions === 'boolean') {
    patch.notify_promotions = body.notify_promotions
  }

  const retail = createRetailClient()

  const { error } = await retail
    .from('customer_push_tokens')
    .update(patch)
    .eq('customer_id', sesi.customerId)

  if (error) {
    console.error('Gagal memperbarui preferensi notifikasi:', error)
    return NextResponse.json({ error: 'Gagal menyimpan preferensi notifikasi' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    preferences: {
      notify_order_status: body.notify_order_status ?? true,
      notify_promotions: body.notify_promotions ?? true,
    },
  })
}
