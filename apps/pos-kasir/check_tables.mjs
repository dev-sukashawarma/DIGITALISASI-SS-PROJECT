
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id, name');
  console.log('Outlets:', outlets.find(o => o.name.toLowerCase().includes('kalisari')));
  
  // Find table names related to checklist
  const { data: rpcData, error } = await supabase.rpc('get_tables'); 
  if (error) console.log(error.message);
}
run();

