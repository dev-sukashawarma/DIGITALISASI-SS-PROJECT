const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('id, name')
    .or('name.ilike.%cicurug%,name.ilike.%kalisari%');
    
  if (outletError) {
    console.error('Error fetching outlets:', outletError);
    return;
  }
  
  const cicurugOutlet = outlets.find(o => o.name.toLowerCase().includes('cicurug'));
  const kalisariOutlet = outlets.find(o => o.name.toLowerCase().includes('kalisari'));

  console.log('Cicurug ID:', cicurugOutlet?.id);
  console.log('Kalisari ID:', kalisariOutlet?.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find Cicurug Order #76
  const { data: cicurugOrders, error: cicurugError } = await supabase
    .from('orders')
    .select('*')
    .eq('outlet_id', cicurugOutlet.id)
    .eq('order_number', 76)
    .gte('created_at', today.toISOString());
    
  if (cicurugOrders && cicurugOrders.length > 0) {
    const order = cicurugOrders[0];
    console.log(`Cancelling Cicurug Order ID: ${order.id}, Number: ${order.order_number}, Customer: ${order.customer_name}`);
    const { data: updatedCicurug, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancellation_status: 'approved',
        cancellation_reason: 'Dibatalkan oleh admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)
      .select();
    if (updateError) console.error('Error updating Cicurug order:', updateError);
    else console.log('Successfully cancelled Cicurug order.');
  } else {
    console.log('Cicurug order #76 for today not found. Trying without date filter to see latest...');
    const { data: latest } = await supabase
      .from('orders')
      .select('*')
      .eq('outlet_id', cicurugOutlet.id)
      .eq('order_number', 76)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (latest && latest.length > 0) {
       console.log('Found latest Cicurug order #76 created at:', latest[0].created_at, 'customer:', latest[0].customer_name);
       const { data: updatedCicurug, error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancellation_status: 'approved',
          cancellation_reason: 'Dibatalkan oleh admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', latest[0].id)
        .select();
      if (updateError) console.error('Error updating Cicurug order:', updateError);
      else console.log('Successfully cancelled Cicurug order.');
    } else {
      console.log('No Cicurug order #76 found at all.');
    }
  }

  // Find Kalisari Order #4
  const { data: kalisariOrders, error: kalisariError } = await supabase
    .from('orders')
    .select('*')
    .eq('outlet_id', kalisariOutlet.id)
    .eq('order_number', 4)
    .gte('created_at', today.toISOString());

  if (kalisariOrders && kalisariOrders.length > 0) {
    const order = kalisariOrders[0];
    console.log(`Cancelling Kalisari Order ID: ${order.id}, Number: ${order.order_number}, Customer: ${order.customer_name}`);
    const { data: updatedKalisari, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancellation_status: 'approved',
        cancellation_reason: 'duplikat',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)
      .select();
    if (updateError) console.error('Error updating Kalisari order:', updateError);
    else console.log('Successfully cancelled Kalisari order.');
  } else {
    console.log('Kalisari order #4 for today not found. Trying without date filter to see latest...');
    const { data: latest } = await supabase
      .from('orders')
      .select('*')
      .eq('outlet_id', kalisariOutlet.id)
      .eq('order_number', 4)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (latest && latest.length > 0) {
       console.log('Found latest Kalisari order #4 created at:', latest[0].created_at, 'customer:', latest[0].customer_name);
       const { data: updatedKalisari, error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancellation_status: 'approved',
          cancellation_reason: 'duplikat',
          updated_at: new Date().toISOString()
        })
        .eq('id', latest[0].id)
        .select();
      if (updateError) console.error('Error updating Kalisari order:', updateError);
      else console.log('Successfully cancelled Kalisari order.');
    } else {
      console.log('No Kalisari order #4 found at all.');
    }
  }
}

main();
