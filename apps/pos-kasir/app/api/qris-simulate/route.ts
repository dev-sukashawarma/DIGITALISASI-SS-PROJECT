import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json()
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: 'preparing', updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) {
      console.error('QRIS simulate error:', error)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
