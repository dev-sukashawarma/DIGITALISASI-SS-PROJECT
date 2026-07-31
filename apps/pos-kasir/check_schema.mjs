
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const r1 = await supabase.from('daily_checklist_records').select('*').limit(2);
  console.log('daily_checklist_records:', JSON.stringify(r1.data, null, 2));
  
  const r2 = await supabase.from('daily_checklist_ticks').select('*').limit(2);
  console.log('daily_checklist_ticks:', JSON.stringify(r2.data, null, 2));

  const r3 = await supabase.from('checklist_items').select('*').limit(5);
  console.log('checklist_items:', JSON.stringify(r3.data, null, 2));
}
run();

