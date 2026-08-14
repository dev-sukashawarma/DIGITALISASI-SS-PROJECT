import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'daily_sales_targets'"
  });
  console.log("Constraints:", data, error);
}
run();
