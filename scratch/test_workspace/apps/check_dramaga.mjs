import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const dramagaId = '550e8400-e29b-41d4-a716-446655440013';
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('outlet_id', dramagaId)
    .lt('created_at', '2026-07-21T00:00:00.000Z')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error querying orders:", error);
    return;
  }
  
  console.log("Here are the top 10 most recent orders for Dramaga before July 21:");
  console.log(orders);
}
run();
