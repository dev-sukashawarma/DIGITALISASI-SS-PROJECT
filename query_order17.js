import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const bnrOutletId = '550e8400-e29b-41d4-a716-446655440001';
  
  console.log("Searching for order #17 in BNR...");
  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number, status, created_at')
    .eq('outlet_id', bnrOutletId)
    .eq('order_number', 17)
    .order('created_at', { ascending: false })
    .limit(5);

  if (orderErr) {
    console.error("Error fetching order:", orderErr);
    return;
  }

  console.log("Found orders:", orders);
  
  if (orders.length > 0) {
    const orderId = orders[0].id;
    console.log(`Checking cancellation requests for order ${orderId}...`);
    
    const { data: requests, error: reqErr } = await supabase
      .from('cancellation_requests')
      .select('*')
      .eq('order_id', orderId);
      
    if (reqErr) {
        console.error("Error fetching cancellation requests:", reqErr);
    } else {
        console.log("Cancellation requests:", requests);
    }
  }
}

main().catch(console.error);
