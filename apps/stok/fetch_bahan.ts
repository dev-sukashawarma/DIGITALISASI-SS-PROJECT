import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await supabase
    .from('bahan_baku')
    .select('nama, kategori, satuan, satuan_kecil, faktor_konversi')
    .order('nama', { ascending: true });

  if (error) {
    console.error('Error fetching bahan baku:', error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

run();
