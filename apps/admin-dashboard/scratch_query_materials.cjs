const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const fixes = [
    { nama: 'SAPI', satuan_kecil: 'gram', faktor_konversi: 2000 },
    { nama: 'MINYAK SAYUR', satuan_kecil: 'ml', faktor_konversi: 16000 },
    { nama: 'GAS 3Kg', satuan_kecil: 'gram', faktor_konversi: 3000 }
  ];

  for (const f of fixes) {
    const { error } = await supabase.from('bahan_baku')
      .update({ satuan_kecil: f.satuan_kecil, faktor_konversi: f.faktor_konversi })
      .eq('nama', f.nama);
    
    if (error) console.error(`Gagal update ${f.nama}:`, error);
    else console.log(`Berhasil update ${f.nama}`);
  }
}
run();
