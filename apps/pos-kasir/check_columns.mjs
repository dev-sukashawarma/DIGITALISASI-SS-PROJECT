
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, payment_method, channel, sales_source, total_amount, discount_amount, promo_subsidy, created_at, cancellation_user_name, void_reason, cancellation_reason, order_items(id, menu_item_name, quantity, subtotal)')
    .limit(1);
    
  console.log('Error:', error);
  console.log('Data:', data);
}
run();

