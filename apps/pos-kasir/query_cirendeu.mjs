import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: outlet } = await supabase.from('outlets').select('id, name').ilike('name', '%cirendeu%').single();
  if (!outlet) { console.log('Outlet Cirendeu not found'); return; }
  console.log('Outlet:', outlet);

  const startOfDay = new Date('2026-08-19T00:00:00+07:00').toISOString();
  const endOfDay = new Date('2026-08-19T23:59:59+07:00').toISOString();

  const { data: orders } = await supabase.from('orders')
    .select('id, order_number, customer_name, status, created_at')
    .eq('outlet_id', outlet.id)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .order('order_number', { ascending: true });
    
  console.log('Orders today:');
  console.table(orders);
}

run();
