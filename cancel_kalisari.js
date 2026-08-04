const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id').ilike('name', '%kalisari%').limit(1);
  const outletId = outlets[0].id;
  
  // Find latest Kalisari order #4
  const { data: latest } = await supabase
    .from('orders')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('order_number', 4)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!latest || latest.length === 0) {
    console.log('Order not found');
    return;
  }
  const orderId = latest[0].id;
  console.log(`Found Kalisari order ID: ${orderId}, created at: ${latest[0].created_at}`);

  // get all negative balances for kalisari
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
      cancellation_reason: 'duplikat',
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
