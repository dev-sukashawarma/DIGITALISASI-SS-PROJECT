
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: beji } = await supabase.from('outlets').select('*').ilike('name', '%beji%').single();
  const { data: other } = await supabase.from('outlets').select('*').neq('id', beji.id).limit(1).single();
  
  console.log('Beji config:', beji);
  console.log('Other config:', other);
}
run();

