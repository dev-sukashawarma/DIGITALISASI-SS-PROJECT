
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: staff } = await supabase.from('outlet_staff').select('id, name, role, outlet_id').eq('role', 'leader');
  console.log('Leaders:', staff);
}
run();

