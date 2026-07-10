import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const itemsToDelete = ["SAUS CABE/TOMAT", "SAUS X HOT"];
  
  console.log(`Menonaktifkan (soft delete): ${itemsToDelete.join(', ')}...`);
  
  const { data, error } = await supabase
    .from('bahan_baku')
    .update({ is_active: false })
    .in('nama', itemsToDelete)
    .select('nama, is_active');
    
  if (error) {
    console.error("Error updating items:", error.message);
  } else {
    console.log("Berhasil menonaktifkan item:", data);
  }
}

main();
