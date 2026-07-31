
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const res = await supabase.from('checklist_items').select('id, description').limit(1).catch(e => e.message);
  console.log('checklist_items exists?', !res.error);
  
  const res2 = await supabase.from('store_checklists').select('*').limit(1);
  console.log('store_checklists:', res2.data ? 'exists' : res2.error);
}
run();

