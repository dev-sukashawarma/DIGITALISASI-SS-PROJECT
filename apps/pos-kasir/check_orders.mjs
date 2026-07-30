
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('orders').select('id, status, channel, sales_source, payment_method, cashier_name, total_amount, created_at, outlet_id').order('created_at', { ascending: false }).limit(20);
  console.log(JSON.stringify(data, null, 2));
}
run();

