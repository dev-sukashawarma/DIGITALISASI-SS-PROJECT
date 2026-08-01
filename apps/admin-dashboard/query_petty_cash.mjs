import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: outlets, error } = await supabase.from('outlets').select('*').ilike('name', '%paledang%');
  console.log("Outlets:", outlets, error);
}
run();
