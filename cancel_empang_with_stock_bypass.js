const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id').ilike('name', '%empang%').limit(1);
  const outletId = outlets[0].id;
  const orderId = '1128e6f3-3a2c-44d8-b1ef-e6c2e8bce1d6';
  
  // get all negative balances
  const { data: stoks } = await supabase.from('stok_balance').select('*').eq('outlet_id', outletId).lt('saldo', 0);
  console.log(`Found ${stoks.length} items with negative balance.`);
  
  // temporarily increase by 100
  for (const s of stoks) {
    await supabase.from('stok_balance')
      .update({ saldo: s.saldo + 100 })
      .eq('id', s.id);
  }
  
  // attempt to cancel order
  console.log('Attempting to cancel order...');
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      status: 'cancelled', 
      cancellation_status: 'approved',
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select();
    
  if (error) {
    console.error('Error cancelling order:', error);
  } else {
    console.log('Order successfully cancelled:', data[0].id);
  }
  
  // restore balances
  console.log('Restoring balances...');
  for (const s of stoks) {
    const { data: current } = await supabase.from('stok_balance').select('saldo').eq('id', s.id).single();
    // we subtract 100 to restore it to what it would have been
    await supabase.from('stok_balance')
      .update({ saldo: current.saldo - 100 })
      .eq('id', s.id);
  }
  console.log('Done.');
}
run();
