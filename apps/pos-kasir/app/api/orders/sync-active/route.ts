import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient as createOrderClient } from '@supabase/supabase-js'

// Endpoint ini menarik status terbaru dari Order System untuk pesanan online
// yang masih "nyangkut" (preparing/ready) di POS Kasir.
export async function POST() {
  try {
    const posDb = createServiceClient()

    // 1. Ambil pesanan online yang masih gantung di kasir
    const { data: localOrders, error: localErr } = await posDb
      .from('orders')
      .select('id, external_order_id, status')
      .eq('source', 'online')
      .in('status', ['preparing', 'ready'])

    if (localErr) {
      console.error('sync-active: gagal get local orders', localErr)
      return NextResponse.json({ error: localErr.message }, { status: 500 })
    }

    if (!localOrders || localOrders.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No pending online orders' })
    }

    const externalIds = localOrders.map(o => o.external_order_id).filter(Boolean)
    if (externalIds.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    // 2. Tanya status terbarunya ke Order System
    const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL!
    const SS_ORDER_ANON_KEY = process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY!
    
    if (!SS_ORDER_URL || !SS_ORDER_ANON_KEY) {
      return NextResponse.json({ error: 'SS_ORDER env missing' }, { status: 500 })
    }

    const ssOrderDb = createOrderClient(SS_ORDER_URL, SS_ORDER_ANON_KEY)

    const { data: remoteOrders, error: remoteErr } = await ssOrderDb
      .from('orders')
      .select('id, status')
      .in('id', externalIds)

    if (remoteErr) {
      console.error('sync-active: gagal get remote orders', remoteErr)
      return NextResponse.json({ error: remoteErr.message }, { status: 500 })
    }

    if (!remoteOrders || remoteOrders.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    // 3. Bandingkan dan update jika perlu
    let updatedCount = 0
    for (const local of localOrders) {
      const remote = remoteOrders.find(r => r.id === local.external_order_id)
      if (remote) {
        // Jika di remote sudah done/ready/cancelled tapi di lokal masih preparing/ready
        if (remote.status === 'done' || remote.status === 'ready' || remote.status === 'cancelled') {
          const mappedStatus = (remote.status === 'done' || remote.status === 'ready') ? 'completed' : 'cancelled'
          
          if (local.status !== mappedStatus) {
            console.log(`sync-active: Update pesanan ${local.external_order_id} -> ${mappedStatus}`)
            const { error: updateErr } = await posDb
              .from('orders')
              .update({ status: mappedStatus, updated_at: new Date().toISOString() })
              .eq('id', local.id)
            
            if (!updateErr) {
              updatedCount++
            } else {
              console.error('sync-active: Gagal update local order', updateErr)
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, count: updatedCount })
  } catch (err: any) {
    console.error('API sync-active error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
