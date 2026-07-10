import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: items, error } = await supabase.from('bahan_baku').select('nama').eq('is_active', true).order('nama');
  if (error) {
    console.error("Error fetching items:", error.message);
  } else {
    console.log(JSON.stringify(items.map(i => i.nama)));
  }
}

main();
