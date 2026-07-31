const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const outletId = '550e8400-e29b-41d4-a716-446655440002'; // Empang
  
  // Find bahan_baku "GAS 3Kg"
  const { data: bahan } = await supabase.from('bahan_baku').select('*').ilike('name', '%GAS%');
  console.log('Bahan:', bahan);
  
  if (bahan && bahan.length > 0) {
    const bahanId = bahan[0].id;
    // Check stok_balance
    const { data: stok } = await supabase.from('stok_balance')
       .select('*')
       .eq('outlet_id', outletId)
       .eq('bahan_baku_id', bahanId);
    console.log('Stok Balance:', stok);
  }
}
main();
