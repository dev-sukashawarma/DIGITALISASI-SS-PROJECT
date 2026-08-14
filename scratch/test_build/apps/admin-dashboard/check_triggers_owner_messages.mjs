import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: "SELECT tgname, proname FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'owner_messages'"
  });
  console.log("Triggers:", data, error);
}
run();
