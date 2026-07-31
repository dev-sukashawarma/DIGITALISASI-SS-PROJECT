
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: beji } = await supabase.from('outlets').select('id, name').ilike('name', '%beji%').single();
  if (beji) {
    const { data: chairul, error } = await supabase.from('outlet_staff').update({ outlet_id: beji.id }).ilike('name', '%chairul rizky%').select('id, name, outlet_id');
    console.log('Updated:', chairul, error);
  }
}
run();

