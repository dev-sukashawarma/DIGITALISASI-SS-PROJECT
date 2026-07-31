
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: orders } = await supabase
    .from('orders')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Latest orders:', orders);
}
run();

