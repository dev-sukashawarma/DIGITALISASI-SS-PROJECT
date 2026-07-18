import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: bahan, error: bahanError } = await supabase.from('bahan_baku').select('id, nama, satuan');
  
  if (bahanError) {
    console.error("Error fetching bahan_baku:", bahanError);
    return;
  }
  
  console.log("=== ALL BAHAN BAKU ===");
  bahan.forEach(b => {
    console.log(`[${b.id}] ${b.nama} (${b.satuan})`);
  });
}

main();
