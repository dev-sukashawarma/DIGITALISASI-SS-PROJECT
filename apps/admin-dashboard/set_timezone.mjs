import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: `
      SELECT current_setting('timezone'), (SELECT current_setting('timezone', true));
    ` 
  });
  console.log("timezone data:", data, "error:", error);

  const { data: d2, error: e2 } = await supabase.from('outlets').select('created_at').limit(1);
  console.log("outlets created_at format after reconnect:", d2, e2);
}
run();
