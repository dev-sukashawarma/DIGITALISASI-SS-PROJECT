require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const itemsToUpdate = [
  { nama: 'SAOS CABE POUCH', kategori: 'item core', satuan: 'Dus', satuan_tengah: 'Kg', faktor_tengah: 12, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'SAOS CABE', kategori: 'item core', satuan: 'Dus', satuan_tengah: 'Kompan', faktor_tengah: 3, satuan_kecil: 'Gram', faktor_konversi: 5500, is_active: true }, 
  { nama: 'SAOS TOMAT POUCH', kategori: 'item core', satuan: 'Dus', satuan_tengah: 'Kg', faktor_tengah: 12, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'SAOS TOMAT KOMPAN', kategori: 'item core', satuan: 'Dus', satuan_tengah: 'Kompan', faktor_tengah: 3, satuan_kecil: 'Gram', faktor_konversi: 5500, is_active: true },
  { nama: 'SAOS SAMYANG', kategori: 'bumbu', satuan: 'Dus', satuan_tengah: 'Kg', faktor_tengah: 5, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'MAYONAISE', kategori: 'item core', satuan: 'Dus', satuan_tengah: 'Kg', faktor_tengah: 12, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'KULIT 25', kategori: 'item core', satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Lembar', faktor_konversi: 20, is_active: true },
  { nama: 'KULIT 28', kategori: 'item core', satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Lembar', faktor_konversi: 20, is_active: true },
  { nama: 'KULIT 32', kategori: 'item core', satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Lembar', faktor_konversi: 20, is_active: true },
  { nama: 'AYAM', kategori: 'item core', satuan: 'Kg', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'SAPI', kategori: 'item core', satuan: 'Blok', satuan_tengah: 'Kg', faktor_tengah: 2, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'KENTANG', kategori: 'item core', satuan: 'Dus', satuan_tengah: 'Kg', faktor_tengah: 10, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'KEJU', kategori: 'item core', satuan: 'Dus', satuan_tengah: 'Pack', faktor_tengah: 24, satuan_kecil: 'Lembar', faktor_konversi: 10, is_active: true }, 
  { nama: 'TUM', kategori: 'item core', satuan: 'Kg', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'BAWANG', kategori: 'bumbu', satuan: 'Bal', satuan_tengah: 'Kg', faktor_tengah: 20, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'TEPUNG', kategori: 'bumbu', satuan: 'Kg', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'MINYAK', kategori: 'item core', satuan: 'Kompan', satuan_tengah: null, faktor_tengah: null, satuan_kecil: null, faktor_konversi: null, is_active: true }, 
  { nama: 'FOIL', kategori: 'kemasan', satuan: 'Dus', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Roll', faktor_konversi: 24, is_active: true },
  { nama: 'HAND GLOVE', kategori: 'kemasan', satuan: 'Box', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Lembar', faktor_konversi: 100, is_active: true },
  { nama: 'THERMAL STRUK', kategori: 'kemasan', satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Roll', faktor_konversi: 10, is_active: true },
  { nama: 'PLASTIK BENING', kategori: 'kemasan', satuan: 'Ikat', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Pack', faktor_konversi: 5, is_active: true },
  { nama: 'PLASTIK KECIL', kategori: 'kemasan', satuan: 'Ikat', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Pack', faktor_konversi: 5, is_active: true },
  { nama: 'POLYBAG', kategori: 'kemasan', satuan: 'Ikat', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Pack', faktor_konversi: 5, is_active: true },
  { nama: 'PLASTIK MERAH', kategori: 'kemasan', satuan: 'Ikat', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Pack', faktor_konversi: 5, is_active: true },
  { nama: 'PAPER WRAP', kategori: 'kemasan', satuan: 'Ikat', satuan_tengah: 'Pack', faktor_tengah: 10, satuan_kecil: 'Lembar', faktor_konversi: 500, is_active: true }, 
  { nama: 'POWDER TEH', kategori: 'minuman', satuan: 'Kg', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'POWDER JERUK', kategori: 'minuman', satuan: 'Kg', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'CUP', kategori: 'kemasan', satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Pcs', faktor_konversi: 25, is_active: true },
  { nama: 'TUTUP PACK', kategori: 'kemasan', satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Pcs', faktor_konversi: 50, is_active: true },
  { nama: 'STIKER', kategori: 'kemasan', satuan: 'Lembar', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Pcs', faktor_konversi: 20, is_active: true },
  { nama: 'MIE', kategori: 'lainnya', satuan: 'Dus', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Bungkus', faktor_konversi: 40, is_active: true },
  { nama: 'SAYUR', kategori: 'item core', satuan: 'Kg', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Gram', faktor_konversi: 1000, is_active: true },
  { nama: 'ES BATU CRYSTAL', kategori: 'minuman', satuan: 'Bal', satuan_tengah: null, faktor_tengah: null, satuan_kecil: null, faktor_konversi: null, is_active: true },
];

async function run() {
  const { data: existingBahan, error: getErr } = await supabase.from('bahan_baku').select('id, nama');
  
  if (getErr) {
    console.error('Error fetching bahan baku:', getErr);
    return;
  }
  
  const existingMap = new Map();
  for (const b of existingBahan) {
    existingMap.set(b.nama.toUpperCase(), b.id);
  }

  const saosCabeKompanId = existingMap.get('SAOS CABE KOMPAN');
  if (saosCabeKompanId) {
    await supabase.from('bahan_baku').update({ is_active: false }).eq('id', saosCabeKompanId);
    console.log('Deactivated SAOS CABE KOMPAN');
  }

  for (const item of itemsToUpdate) {
    const id = existingMap.get(item.nama.toUpperCase());
    if (id) {
      console.log(`Updating ${item.nama}`);
      const { error } = await supabase.from('bahan_baku').update(item).eq('id', id);
      if (error) console.error(`Failed to update ${item.nama}:`, error);
    } else {
      console.log(`Inserting new ${item.nama}`);
      const { error } = await supabase.from('bahan_baku').insert(item);
      if (error) console.error(`Failed to insert ${item.nama}:`, error);
    }
  }
  
  console.log('Update complete!');
}

run();
