import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const suiteUrl = Deno.env.get('SUPABASE_URL')
const suiteServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!suiteUrl || !suiteServiceKey) {
  throw new Error('Missing required environment variables')
}

const suiteClient = createClient(suiteUrl, suiteServiceKey)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const payload = await req.json()
    
    // Payload from Supabase Database Webhooks has type, table, record, old_record, schema
    if (payload.table !== 'orders' || !payload.record) {
       return new Response(JSON.stringify({ message: 'Ignored: not an order record' }), { status: 200 })
    }

    const { type, record } = payload

    if (type !== 'INSERT' && type !== 'UPDATE') {
        return new Response(JSON.stringify({ message: 'Ignored: not an insert/update' }), { status: 200 })
    }

    if (record.status !== 'completed' && record.status !== 'done' && record.status !== 'cancelled') {
        return new Response(JSON.stringify({ message: 'Ignored: order not completed, done, or cancelled' }), { status: 200 })
    }

    // Smart detection for online orders
    let finalSalesSource = record.source || 'online';
    
    // Check notes for website/online order signatures
    const notesLower = (record.notes || '').toLowerCase();
    if (notesLower.includes('info pemesan online') || notesLower.includes('[website]')) {
      finalSalesSource = 'online';
    }

    // Upsert into Suite project
    let mappedPaymentMethod = record.payment_method || 'qris';
    if (!['cash', 'qris', 'card'].includes(mappedPaymentMethod)) {
      mappedPaymentMethod = 'qris';
    }

    let mappedStatus = record.status;
    if (mappedStatus === 'paid' || mappedStatus === 'done') {
      mappedStatus = 'completed';
    }

    const outletMap = {
      '0a952b3e-3d12-46ce-b325-8244a0709765': '550e8400-e29b-41d4-a716-446655440004', // Cimanggu
      '6e10168e-4cb6-492b-8412-eee4fef1bd20': '550e8400-e29b-41d4-a716-446655440013', // Dramaga
      'f03b9742-f19f-431d-b278-6885c12434ac': '550e8400-e29b-41d4-a716-446655440014', // Cibinong
      '8d79e331-9cea-41aa-8b08-6a4781ae6cd3': '00000000-0000-0000-0000-000000000000', // Tebet -> Global Outlet
    };
    const finalOutletId = outletMap[record.outlet_id] || record.outlet_id;

    const { error: upsertError, data: upserted } = await suiteClient
      .from('orders')
      .upsert({
        id: record.id,
        outlet_id: finalOutletId,
        customer_name: record.customer_name || 'Online Customer',
        status: mappedStatus,
        payment_method: mappedPaymentMethod,
        total_amount: record.total_amount !== undefined ? record.total_amount : record.total,
        notes: record.notes,
        created_at: record.created_at,
        updated_at: record.updated_at,
        sales_source: finalSalesSource,
        void_reason: record.void_reason,
        void_at: record.void_at,
        voided_by: record.voided_by
      }, { onConflict: 'id' })
      .select()

    if (upsertError) throw upsertError

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced order ${record.id} successfully`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Webhook Error:', errorMsg)
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
