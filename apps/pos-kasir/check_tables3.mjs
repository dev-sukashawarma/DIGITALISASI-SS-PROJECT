
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const res2 = await supabase.from('store_checklists').select('*').limit(1);
  console.log('store_checklists:', res2.data ? 'exists' : res2.error);
  
  const res3 = await supabase.from('checklist_items').select('*').limit(1);
  console.log('checklist_items:', res3.data ? 'exists' : res3.error);
  
  const res4 = await supabase.from('checklist_records').select('*').limit(1);
  console.log('checklist_records:', res4.data ? 'exists' : res4.error);
  
  const res5 = await supabase.from('checklist_submissions').select('*').limit(1);
  console.log('checklist_submissions:', res5.data ? 'exists' : res5.error);
}
run();

