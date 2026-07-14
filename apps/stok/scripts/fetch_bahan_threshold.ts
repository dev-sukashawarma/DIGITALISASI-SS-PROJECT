import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  const { data, error } = await supabase
    .from('bahan_baku')
    .select('nama, kategori, satuan, satuan_kecil, satuan_tengah, faktor_konversi, faktor_tampilan, is_active')
    .eq('is_active', true)
    .order('kategori', { ascending: true })
    .order('nama', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

run();
