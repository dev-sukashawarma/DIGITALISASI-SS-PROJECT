import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('bahan_baku')
    .select('nama, satuan, satuan_kecil, faktor_konversi, faktor_tampilan')
    .ilike('nama', '%KENTANG%')
    .limit(1);
    
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('BB cols:', data);
  }
}

run();
