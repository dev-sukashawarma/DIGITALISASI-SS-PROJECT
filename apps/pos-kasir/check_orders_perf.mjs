
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const start = Date.now();
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, payment_method, channel, sales_source, total_amount, discount_amount, promo_subsidy, created_at, cancellation_user_name, void_reason, cancellation_reason, order_items(id, menu_item_name, quantity, subtotal)')
    .gte('created_at', yesterday.toISOString())
    .lte('created_at', today.toISOString());
    
  console.log('Query took:', Date.now() - start, 'ms');
  console.log('Rows:', orders?.length, 'Error:', error);
}
run();

