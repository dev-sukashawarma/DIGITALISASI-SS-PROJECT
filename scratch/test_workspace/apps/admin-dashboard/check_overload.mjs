import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: "SELECT proname, proargnames, proargtypes FROM pg_proc WHERE proname = 'set_daily_target'"
  });
  console.log("Functions:", data, error);
}
run();
