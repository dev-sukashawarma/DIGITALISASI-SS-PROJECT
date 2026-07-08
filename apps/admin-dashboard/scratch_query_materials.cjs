const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const oldSausTomatCrtId = '44f9b147-d65a-4a46-b031-8a939a195201';
  const newSaosTomatKgId = '841dc31e-a5c0-4a8d-b599-eead717108cc'; // SAOS TOMAT (kg) we created
  const resepId = '3410ab1b-dcbf-4431-8276-7e0e8eca9331'; // Original Mix Jumbo

  // Delete SAUS TOMAT (crt) from resep_item
  const { error: err1 } = await supabase
    .from('resep_item')
    .delete()
    .eq('resep_id', resepId)
    .eq('bahan_baku_id', oldSausTomatCrtId);
  console.log("Deleted old SAUS TOMAT from recipe:", err1 ? err1.message : "Success");

  // Fetch current SAOS TOMAT (kg) in that recipe
  const { data: currentItems, error: err2 } = await supabase
    .from('resep_item')
    .select('*')
    .eq('resep_id', resepId)
    .eq('bahan_baku_id', newSaosTomatKgId);
    
  if (currentItems && currentItems.length > 0) {
    const item = currentItems[0];
    const newQty = Number(item.qty_per_porsi) + 1; // add 1 crt
    const { error: err3 } = await supabase
      .from('resep_item')
      .update({ qty_per_porsi: newQty })
      .eq('resep_id', resepId)
      .eq('bahan_baku_id', newSaosTomatKgId);
    console.log("Updated SAOS TOMAT qty to", newQty, ":", err3 ? err3.message : "Success");
  }

  // Deactivate SAUS TOMAT (crt)
  const { error: err4 } = await supabase
    .from('bahan_baku')
    .update({ is_active: false })
    .eq('id', oldSausTomatCrtId);
  console.log("Deactivated SAUS TOMAT (crt):", err4 ? err4.message : "Success");
}
run();
