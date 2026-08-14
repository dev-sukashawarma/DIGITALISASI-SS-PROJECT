import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('daily_sales_targets').select('id').limit(1);
  if(error) console.error(error);
  
  // We can just fetch via REST the OpenAPI spec to see the functions!
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
    headers: { 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY }
  });
  const spec = await res.json();
  const funcs = Object.keys(spec.paths).filter(p => p.includes('set_daily_target'));
  console.log("Functions in PostgREST:", funcs);
}
run();
