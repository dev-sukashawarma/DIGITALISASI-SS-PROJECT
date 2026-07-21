import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.rpc('exec_sql', { sql_query: "SELECT proname, prosrc FROM pg_proc WHERE proname IN ('set_daily_target', 'send_owner_message')" }).then(r => console.log(JSON.stringify(r.data, null, 2))).catch(console.error);
