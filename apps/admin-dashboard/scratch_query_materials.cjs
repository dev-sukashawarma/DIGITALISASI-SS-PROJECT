const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('bahan_baku')
    .select('nama, satuan, satuan_kecil, faktor_konversi, kategori')
    .eq('is_active', true)
    .order('nama');
    
  if (error) return console.error(error);
  
  console.log('| Nama Bahan Baku | Kategori | Satuan Beli | Konversi (Satuan Resep) |');
  console.log('|---|---|---|---|');
  data.forEach(d => {
    let konversi = '-';
    if (d.faktor_konversi && d.faktor_konversi !== 1 && d.satuan_kecil) {
      konversi = `1 ${d.satuan} = ${d.faktor_konversi} ${d.satuan_kecil}`;
    } else if (d.faktor_konversi === 1) {
      konversi = `1 ${d.satuan} = 1 ${d.satuan}`; // Or just "-"
    }
    console.log(`| **${d.nama}** | ${d.kategori} | ${d.satuan} | ${konversi} |`);
  });
}
run();
