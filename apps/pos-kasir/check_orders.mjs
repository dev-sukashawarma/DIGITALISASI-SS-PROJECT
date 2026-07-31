
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: kalisari } = await supabase.from('outlets').select('id, name').ilike('name', '%kalisari%').single();
  const { data: beji } = await supabase.from('outlets').select('id, name').ilike('name', '%beji%').single();
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log('Querying from:', yesterday.toISOString(), 'to', today.toISOString());
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, outlet_id, status, total_amount, created_at')
    .gte('created_at', yesterday.toISOString())
    .lte('created_at', today.toISOString());
    
  console.log('Orders found:', orders?.length, 'Error:', error);
  if (orders && orders.length > 0) {
    const kOrders = orders.filter(o => o.outlet_id === kalisari?.id);
    const bOrders = orders.filter(o => o.outlet_id === beji?.id);
    console.log('Kalisari orders:', kOrders.length);
    console.log('Beji orders:', bOrders.length);
  } else {
    // try to get any order in the last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, outlet_id, status, total_amount, created_at')
      .gte('created_at', lastWeek.toISOString());
    console.log('Recent orders (last 7 days):', recentOrders?.length);
    if (recentOrders && recentOrders.length > 0) {
      console.log('Sample recent order:', recentOrders[0].created_at);
    }
  }
}
run();

