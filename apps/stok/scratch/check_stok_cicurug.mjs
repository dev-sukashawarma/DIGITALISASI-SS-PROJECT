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
  console.log("Cicurug Outlet ID:", outletId);

  const keywords = [
    'cabe', 'tomat', 'samyang', 'mayo', 'kulit', 'ayam', 'sapi', 'kentang',
    'keju', 'tum', 'bawang', 'tepung', 'minyak', 'foil', 'thermal', 'glove',
    'paper wrap', 'plastik', 'polybag', 'powder teh', 'powder jeruk', 'cup',
    'sendok takar', 'scoop', 'cooler'
  ];

  let query = supabase.from('bahan_baku').select('id, nama, satuan');
  
  const { data: bahan, error: bahanError } = await query;
  
  if (bahanError) {
    console.error("Error fetching bahan_baku:", bahanError);
    return;
  }
  
  // Filter materials based on keywords
  const matchedBahan = bahan.filter(b => 
    keywords.some(k => b.nama.toLowerCase().includes(k.toLowerCase()))
  );
  
  const matchedBahanIds = matchedBahan.map(b => b.id);
  
  const { data: stok, error: stokError } = await supabase
    .from('stok_balance')
    .select('*')
    .eq('outlet_id', outletId)
    .in('bahan_baku_id', matchedBahanIds);
    
  if (stokError) {
    console.error("Error fetching stok_balance:", stokError);
    return;
  }
  
  console.log("=== MATCHED BAHAN BAKU ===");
  matchedBahan.forEach(b => {
    const s = stok.find(st => st.bahan_baku_id === b.id);
    console.log(`[${b.id}] ${b.nama} (${b.satuan}) -> Current Stok: ${s ? s.saldo : 0}`);
  });
}

main();
