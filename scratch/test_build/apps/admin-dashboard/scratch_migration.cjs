const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '../../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const oldId = '527682ad-96ee-43bb-9f77-eccad84c5976';
  const cabeId = crypto.randomUUID();
  const tomatId = crypto.randomUUID();

  try {
    console.log('1. Membuat bahan baku SAOS CABE...');
    const { error: err1 } = await supabase.from('bahan_baku').insert({
      id: cabeId,
      nama: 'SAOS CABE',
      satuan: 'kg',
      kategori: 'saus',
      kategori_core: 'saos',
      is_active: true
    });
    if (err1) throw err1;

    console.log('2. Membuat bahan baku SAOS TOMAT...');
    const { error: err2 } = await supabase.from('bahan_baku').insert({
      id: tomatId,
      nama: 'SAOS TOMAT', 
      satuan: 'kg',
      kategori: 'saus',
      kategori_core: 'saos',
      is_active: true
    });
    if (err2) throw err2;

    console.log('3. Menyimpan harga untuk SAOS CABE...');
    const { error: err3 } = await supabase.from('bahan_baku_harga').insert({
      bahan_baku_id: cabeId,
      harga_beli: 15000,
      kemasan_qty: 1000,
      kemasan_satuan: 'gram',
      harga_updated_at: new Date().toISOString()
    });
    if (err3) throw err3;

    console.log('4. Menyimpan harga untuk SAOS TOMAT...');
    const { error: err4 } = await supabase.from('bahan_baku_harga').insert({
      bahan_baku_id: tomatId,
      harga_beli: 15000,
      kemasan_qty: 1000,
      kemasan_satuan: 'gram',
      harga_updated_at: new Date().toISOString()
    });
    if (err4) throw err4;

    console.log('5. Mengambil resep_item lama...');
    const { data: oldItems, error: err5 } = await supabase
      .from('resep_item')
      .select('*')
      .eq('bahan_baku_id', oldId);
    if (err5) throw err5;

    console.log(`Ditemukan ${oldItems.length} resep yang menggunakan SAUS CABE/TOMAT.`);

    const newItems = [];
    oldItems.forEach(item => {
      const splitQty = Number(item.qty_per_porsi) / 2;
      
      // Cabe
      newItems.push({
        resep_id: item.resep_id,
        bahan_baku_id: cabeId,
        qty_per_porsi: splitQty,
        satuan: item.satuan
      });
      // Tomat
      newItems.push({
        resep_id: item.resep_id,
        bahan_baku_id: tomatId,
        qty_per_porsi: splitQty,
        satuan: item.satuan
      });
    });

    console.log('6. Memasukkan resep_item baru...');
    if (newItems.length > 0) {
      const { error: err6 } = await supabase.from('resep_item').insert(newItems);
      if (err6) throw err6;
    }

    console.log('7. Menghapus resep_item lama...');
    if (oldItems.length > 0) {
      const { error: err7 } = await supabase
        .from('resep_item')
        .delete()
        .eq('bahan_baku_id', oldId);
      if (err7) throw err7;
    }

    console.log('8. Menonaktifkan bahan baku lama...');
    const { error: err8 } = await supabase
      .from('bahan_baku')
      .update({ is_active: false })
      .eq('id', oldId);
    if (err8) throw err8;

    console.log('--- Migrasi Berhasil! ---');

  } catch (e) {
    console.error('Migration failed:', e);
  }
}

run();
