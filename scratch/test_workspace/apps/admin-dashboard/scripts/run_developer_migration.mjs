import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: `
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'outlet_staff' AND column_name = 'role';
    ` 
  });
  console.log("data:", data, "error:", error);
}
run();
