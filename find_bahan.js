const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function run() {
  const { data: bahan, error } = await supabase.from('bahan_baku').select('*').ilike('nama', '%FOIL%');
  console.log('Bahan Baku:', bahan);
  
  if (bahan && bahan.length > 0) {
    const foilId = bahan[0].id;
    const { data: outlets } = await supabase.from('outlets').select('id').ilike('name', '%empang%').limit(1);
    const outletId = outlets[0].id;
    
    // Add stock
    const { data: added, error: err } = await supabase.from('mutasi_stok').insert({
      outlet_id: outletId,
      bahan_baku_id: foilId,
      jenis_mutasi: 'masuk',
      jumlah: 50,
      keterangan: 'Temporary adjustment for cancellation'
    }).select();
    
    console.log('Mutasi:', added, err);
  }
}
run();
