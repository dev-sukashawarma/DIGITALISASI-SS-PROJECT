
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
  
  const { data: orders } = await supabase
    .from('orders')
    .select('id, outlet_id, status, total_amount, created_at')
    .gte('created_at', yesterday.toISOString())
    .lte('created_at', today.toISOString());
    
  if (orders) {
    const statuses = {};
    for (const o of orders) {
      statuses[o.status] = (statuses[o.status] || 0) + 1;
    }
    console.log('Statuses for yesterday:', statuses);
  }
}
run();

