import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: outlet, error: outletError } = await supabase
    .from('outlets')
    .select('id, name')
    .ilike('name', '%cicurug%')
    .single();

  if (outletError) {
    console.error('Error finding outlet:', outletError);
    return;
  }
  
  const startOfDay = new Date('2026-08-01T00:00:00+07:00').toISOString();
  const endOfDay = new Date('2026-08-01T23:59:59+07:00').toISOString();
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('outlet_id', outlet.id)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .eq('order_number', 66);
    
  if (error) {
    console.error('Error querying orders:', error);
    return;
  }
  
  if (orders && orders.length > 0) {
    const orderId = orders[0].id;
    const now = new Date().toISOString();
    
    console.log('Found order:', orderId, orders[0].customer_name);

    const { data: updateData, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        void_reason: 'double input (void by admin)',
        void_at: now,
        cancellation_status: 'approved',
        cancellation_reason: 'double input (void by admin)',
        updated_at: now
      })
      .eq('id', orderId)
      .select();

    if (updateError) {
      console.error('Error voiding order:', updateError);
    } else {
      console.log('Successfully voided order:', updateData);
    }
  } else {
    console.log('Order #66 not found for today in Cicurug');
  }
}

run();
