import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('orders').select('*').limit(1);
  if (error) console.error("orders error:", error);
  else console.log("orders:", data[0] ? Object.keys(data[0]) : "empty");

  const { data: o2 } = await supabase.from('order_items').select('*').limit(1);
  console.log("order_items:", o2?.[0] ? Object.keys(o2[0]) : "empty");

  const { data: o3 } = await supabase.from('outlets').select('*').limit(1);
  console.log("outlets:", o3?.[0] ? Object.keys(o3[0]) : "empty");

  const { data: o4 } = await supabase.from('menus').select('*').limit(1);
  console.log("menus:", o4?.[0] ? Object.keys(o4[0]) : "empty");
}
run();
