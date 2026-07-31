
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: kalisari } = await supabase.from('outlets').select('id, name').ilike('name', '%kalisari%').single();
  console.log('Kalisari:', kalisari);
  
  if (kalisari) {
    const { data: tri, error } = await supabase.from('outlet_staff').update({ outlet_id: kalisari.id }).ilike('name', '%tri rizky%').select('id, name, outlet_id');
    console.log('Updated:', tri, error);
  }
}
run();

