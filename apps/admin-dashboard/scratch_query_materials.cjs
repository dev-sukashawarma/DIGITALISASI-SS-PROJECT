const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const ids = [
    '841dc31e-a5c0-4a8d-b599-eead717108cc', // SAOS TOMAT (kg)
    '0e2617f6-6c1e-4509-9b41-b8ef5d8ad3b6'  // SAOS CABE (kg) (I'll need to fetch the actual ID for CABE to be safe)
  ];

  // Let's just update all harga_beli_display based on current faktor_konversi to fix any sync issues.
  const { data: bbh, error: err1 } = await supabase.from('bahan_baku_harga').select('*, bahan_baku(id, faktor_konversi)');
  if (err1) return console.error(err1);

  for (const row of bbh) {
    if (!row.bahan_baku) continue;
    const v_fk = row.bahan_baku.faktor_konversi || 1;
    let expected_display = row.harga_beli;
    if (row.kemasan_qty) {
      expected_display = (row.harga_beli / v_fk) * row.kemasan_qty;
    }

    if (row.harga_beli_display !== expected_display) {
      console.log(`Fixing ${row.bahan_baku.id}: ${row.harga_beli_display} -> ${expected_display}`);
      const { error: err2 } = await supabase.from('bahan_baku_harga').update({ harga_beli_display: expected_display }).eq('bahan_baku_id', row.bahan_baku.id);
      if (err2) console.error("Error updating", row.bahan_baku.id, err2);
    }
  }
  console.log("Sync complete!");
}

run();
