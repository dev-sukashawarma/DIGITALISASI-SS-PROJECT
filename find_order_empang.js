const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function run() {
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('*')
    .ilike('name', '%empang%');
    
  if (outletError) {
    console.error('Error fetching outlet:', outletError);
    return;
  }
  
  if (outlets.length === 0) {
    console.log('No outlet found for empang');
    return;
  }
  
  console.log('Outlets:', outlets.map(o => o.name));
  const outletId = outlets[0].id;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: orders, error: fetchErr } = await supabase
    .from('orders')
    .select('*, order_items(*, menu_items(name))')
    .eq('outlet_id', outletId)
    // .gte('created_at', today.toISOString()) // Let's check all recent orders just in case
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (fetchErr) {
    console.error('Error fetching orders:', fetchErr);
    return;
  }
  
  const matchingOrders = orders.filter(o => 
    (o.order_number && o.order_number.toString().includes('3')) ||
    (o.channel && o.channel.toLowerCase().includes('gofood')) ||
    (o.sales_source && o.sales_source.toLowerCase().includes('gofood'))
  );
  
  if (matchingOrders.length > 0) {
    console.log(`Found ${matchingOrders.length} matching orders:`);
    matchingOrders.forEach(o => {
      console.log(`ID: ${o.id}, Date: ${o.created_at}, Order: ${o.order_number}, Customer: ${o.customer_name}, Status: ${o.status}, Source: ${o.sales_source}, Channel: ${o.channel}`);
    });
  } else {
    console.log('No matching orders found');
  }
}
run();
