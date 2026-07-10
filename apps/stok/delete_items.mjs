import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const itemsToDelete = ["SAUS CABE/TOMAT", "SAUS X HOT"];
  
  console.log(`Menghapus: ${itemsToDelete.join(', ')}...`);
  
  const { data, error } = await supabase
    .from('bahan_baku')
    .delete()
    .in('nama', itemsToDelete)
    .select('nama');
    
  if (error) {
    console.error("Error deleting items:", error.message);
  } else {
    console.log("Berhasil menghapus item:", data.map(i => i.nama));
  }
}

main();
