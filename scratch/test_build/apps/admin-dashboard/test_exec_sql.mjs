import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: `
      DO $$
      DECLARE
        v_err TEXT;
      BEGIN
        RAISE NOTICE 'Testing';
      END;
      $$;
    ` 
  });
  console.log("data:", data, "error:", error);
}
run();
