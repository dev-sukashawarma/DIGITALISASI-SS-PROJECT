require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('id, name')
    .ilike('name', '%paledang%');
    
  if (outletError) return console.error(outletError);
  if (!outlets || outlets.length === 0) return console.log('Outlet Paledang not found.');
  
  const paledangId = outlets[0].id;
  
  const { data: sample, error: sampleError } = await supabase
    .from('orders')
    .select('*')
    .eq('outlet_id', paledangId)
    .limit(1);
    
  if (sampleError) return console.error(sampleError);
  console.log('Order columns:', Object.keys(sample[0]));
  
  // Let's try to query by date prefix anyway and list today's orders
  const datePrefix = '2026-07-29';
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', paledangId)
    .gte('created_at', `${datePrefix}T00:00:00Z`)
    .lte('created_at', `${datePrefix}T23:59:59Z`)
    .order('created_at', { ascending: true });
    
  if (ordersError) return console.error(ordersError);
  
  console.log(`\nFound ${orders.length} orders for Paledang on ${datePrefix}.`);
  // If we can't find by queue_number directly, maybe we just print them and let's find the 5th order of the day?
  // Or check if there is an 'order_number' or similar column.
  
  if (orders.length >= 5) {
      console.log('\n--- The 5th order of the day ---');
      console.dir(orders[4], { depth: null });
  } else {
      console.log('\nAll orders:');
      orders.forEach((o, i) => {
          console.log(`\n--- Order ${i+1} ---`);
          console.log(`ID: ${o.id}`);
          console.log(`Created: ${o.created_at}`);
          console.log(`Total: ${o.total_amount}`);
          console.log(`Payment: ${o.payment_status} via ${o.payment_method}`);
          console.log(`Items: ${o.order_items.length}`);
      });
  }
}
run();
