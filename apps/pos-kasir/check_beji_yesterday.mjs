
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: beji } = await supabase.from('outlets').select('id, name').ilike('name', '%beji%').single();
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total_amount, created_at')
    .eq('outlet_id', beji.id)
    .gte('created_at', yesterday.toISOString())
    .lte('created_at', today.toISOString());
    
  console.log('Beji orders yesterday:', orders?.length);
  if (orders && orders.length > 0) {
    const sum = orders.filter(o => o.status === 'completed').reduce((acc, o) => acc + (Number(o.total_amount)||0), 0);
    console.log('Total sales:', sum);
  }
}
run();

