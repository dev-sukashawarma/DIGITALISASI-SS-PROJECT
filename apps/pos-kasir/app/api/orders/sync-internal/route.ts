import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { external_order_id, status } = await request.json()

    if (!external_order_id || !status) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const posDb = createServiceClient()

    // Cari order
    const { data: order } = await posDb
      .from('orders')
      .select('id, status')
      .eq('external_order_id', external_order_id)
      .eq('source', 'online')
      .maybeSingle()

    if (!order) {
      // Boleh diabaikan kalau tidak ketemu
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
