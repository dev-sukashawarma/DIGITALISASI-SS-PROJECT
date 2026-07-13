import { NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabaseUser = await createClient()
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { order_id, status, void_reason, void_at, voided_by } = body

    if (!order_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabaseService = createServiceClient()

    const updateData: any = { 
      status, 
      updated_at: new Date().toISOString() 
    }
    
    if (void_reason) updateData.void_reason = void_reason
    if (void_at) updateData.void_at = void_at
    if (voided_by) updateData.voided_by = voided_by

    const { error: updateError } = await supabaseService
      .from('orders')
      .update(updateData)
      .eq('id', order_id)

    if (updateError) {
      console.error('Failed to update order status:', updateError)
      return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Internal API error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
