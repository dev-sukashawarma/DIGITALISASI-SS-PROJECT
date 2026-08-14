import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: targets } = await supabase.from('daily_sales_targets').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Targets:", targets);
  
  const { data: messages } = await supabase.from('owner_messages').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Messages:", messages);
}
run();
