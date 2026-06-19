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

    if (record.status !== 'completed') {
        return new Response(JSON.stringify({ message: 'Ignored: order not completed' }), { status: 200 })
    }

    // Upsert into Suite project
    const { error: upsertError, data: upserted } = await suiteClient
      .from('orders')
      .upsert({
        id: record.id,
        outlet_id: record.outlet_id,
        customer_name: record.customer_name || 'Online Customer',
        status: record.status,
        payment_method: record.payment_method || 'qris',
        total_amount: record.total_amount,
        notes: record.notes,
        created_at: record.created_at,
        updated_at: record.updated_at,
        sales_source: 'online'
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
