
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'orders' }).catch(() => ({}));
  if (data) {
    console.log('Policies from RPC:', data);
  } else {
    // If no RPC, let's just query pg_policies
    const { data: policies, error: err2 } = await supabase
      .from('pg_policies') // won't work via REST usually unless exposed
      .select('*')
      .eq('tablename', 'orders');
    console.log('Policies:', policies, err2?.message);
  }
}
run();

