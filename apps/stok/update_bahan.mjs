import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("Adding SEDOTAN...");
  const { data: sedotan, error: errSedotan } = await supabase.from('bahan_baku').insert({
    nama: 'SEDOTAN',
    kategori: 'kemasan',
    satuan: 'pack',
    satuan_kecil: 'pcs',
    faktor_konversi: 1, // Defaulting to 1, since the exact conversion is unknown
    is_active: true
  });
  if (errSedotan) console.error("Error inserting SEDOTAN:", errSedotan);
  else console.log("Successfully inserted SEDOTAN");

  console.log("Fetching POWDER MIX...");
  const { data: powderMix, error: errPowder } = await supabase.from('bahan_baku').select('*').eq('nama', 'POWDER MIX').single();
  if (errPowder) {
    console.error("Error fetching POWDER MIX:", errPowder);
  } else if (powderMix) {
    console.log("Inserting POWDER TEH and POWDER JERUK...");
    const { error: errTeh } = await supabase.from('bahan_baku').insert({
      ...powderMix,
      id: undefined,
      nama: 'POWDER TEH',
      created_at: undefined,
      updated_at: undefined
    });
    if (errTeh) console.error("Error inserting POWDER TEH:", errTeh);

    const { error: errJeruk } = await supabase.from('bahan_baku').insert({
      ...powderMix,
      id: undefined,
      nama: 'POWDER JERUK',
      created_at: undefined,
      updated_at: undefined
    });
    if (errJeruk) console.error("Error inserting POWDER JERUK:", errJeruk);

    console.log("Deactivating POWDER MIX...");
    const { error: errDeactivate } = await supabase.from('bahan_baku').update({ is_active: false }).eq('nama', 'POWDER MIX');
    if (errDeactivate) console.error("Error deactivating POWDER MIX:", errDeactivate);
    
    console.log("Update completed.");
  }
}

main();
