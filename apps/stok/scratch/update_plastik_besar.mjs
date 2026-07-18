import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('*')
    .ilike('name', '%cicurug%');

  if (outletError || !outlets || outlets.length === 0) {
    console.error("Outlet Cicurug not found:", outletError);
    return;
  }
  
  const outletId = outlets[0].id;

  const itemToUpdate = { id: 'ef7fdaf9-1e51-4e46-9ef2-3df1159a4273', qty: 35 }; // PLASTIK BESAR

  // Get current stock
  const { data: currentStock, error: currentStockError } = await supabase
    .from('stok_balance')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('bahan_baku_id', itemToUpdate.id);
    
  if (currentStockError) {
    console.error("Error fetching current stock", currentStockError);
    return;
  }

  const existingStok = currentStock[0];
  const now = new Date().toISOString();
  
  if (existingStok) {
    const { error: updateError } = await supabase
      .from('stok_balance')
      .update({ saldo: itemToUpdate.qty, updated_at: now })
      .eq('id', existingStok.id);
      
    if (updateError) {
      console.error(`Error updating PLASTIK BESAR:`, updateError);
    } else {
      console.log(`✅ Updated PLASTIK BESAR to ${itemToUpdate.qty} (was ${existingStok.saldo})`);
    }
  } else {
    const { error: insertError } = await supabase
      .from('stok_balance')
      .insert({
        outlet_id: outletId,
        bahan_baku_id: itemToUpdate.id,
        saldo: itemToUpdate.qty,
        updated_at: now
      });
      
    if (insertError) {
      console.error(`Error inserting PLASTIK BESAR:`, insertError);
    } else {
      console.log(`✅ Inserted PLASTIK BESAR with qty ${itemToUpdate.qty}`);
    }
  }

  console.log("Done!");
}

main();
