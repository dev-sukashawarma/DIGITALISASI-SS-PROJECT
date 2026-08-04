const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id').ilike('name', '%empang%').limit(1);
  const outletId = outlets[0].id;
  const foilId = '4804d1fc-f06c-4306-adfd-a798bda1275a';
  
  // get current balance
  const { data: stok } = await supabase.from('stok_balance').select('*').eq('outlet_id', outletId).eq('bahan_baku_id', foilId).limit(1);
  const currentSaldo = stok[0].saldo;
  console.log('Current Saldo:', currentSaldo);
  
  // temporarily increase by 100
  const { data: updated, error } = await supabase.from('stok_balance')
    .update({ saldo: currentSaldo + 100 })
    .eq('outlet_id', outletId)
    .eq('bahan_baku_id', foilId)
    .select();
    
  console.log('Update Result:', updated, error);
}
run();
