import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: items, error } = await supabase
    .from('bahan_baku')
    .select('nama, kategori, satuan, satuan_kecil, faktor_konversi')
    .eq('is_active', true)
    .order('kategori')
    .order('nama');
    
  if (error) {
    console.error("Error fetching items:", error.message);
  } else {
    fs.writeFileSync('bahan_baku.json', JSON.stringify(items, null, 2));
    console.log("Berhasil mengekspor data ke bahan_baku.json");
  }
}

main();
