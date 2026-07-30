
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  let query = supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });

  // Simulate thisMonth
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  query = query.gte('created_at', d.toISOString());

  const { data, error } = await query;
  if (error) console.error(error);
  else console.log('Fetched orders count:', data.length);
  if (data && data.length > 0) {
    const fromOutletTes = data.filter(o => o.outlet_id === 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a');
    console.log('Orders from outlet tes:', fromOutletTes.length);
    if (fromOutletTes.length > 0) {
       console.log('First from outlet tes status:', fromOutletTes[0].status);
    }
  }
}
run();

