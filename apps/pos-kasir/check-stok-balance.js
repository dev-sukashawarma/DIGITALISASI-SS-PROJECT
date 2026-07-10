require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: bahanBaku, error: bbError } = await supabase
    .from('bahan_baku')
    .select('id, nama')
    .in('nama', ['MINYAK SAYUR', 'SAOS CABE', 'SAOS TOMAT']);
    
  if (bbError) {
    console.error(bbError);
    return;
  }
  
  console.log("Bahan Baku IDs:", bahanBaku);
  
  const bbIds = bahanBaku.map(b => b.id);
  
  const { data: stok, error: stokError } = await supabase
    .from('stok_balance')
    .select('outlet_id, bahan_baku_id, saldo, outlets(name)')
    .in('bahan_baku_id', bbIds);
    
  if (stokError) {
    console.error(stokError);
    return;
  }
  
  const result = stok.map(s => ({
    outlet: s.outlets?.name || s.outlet_id,
    bahan_baku: bahanBaku.find(b => b.id === s.bahan_baku_id)?.nama,
    saldo: s.saldo
  }));
  
  console.log("Stok Balance:\n", JSON.stringify(result, null, 2));
}
run();
