const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function run() {
  // Find outlet "cicurug"
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('*')
    .ilike('name', '%cicurug%');
    
  if (outletError) {
    console.error('Error fetching outlet:', outletError);
    return;
  }
  console.log('Outlets:', outlets.map(o => o.name));

  if (outlets.length === 0) return;
  const outletId = outlets[0].id;
  
  // Search for vira in the last few days
  const { data: orders, error: fetchErr } = await supabase
    .from('orders')
    .select('*, order_items(*, menu_items(name))')
    .eq('outlet_id', outletId)
    .ilike('customer_name', '%vira%')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (fetchErr) {
    console.error('Error fetching orders:', fetchErr);
    return;
  }
  
  if (orders && orders.length > 0) {
    console.log(`Found ${orders.length} orders for vira:`);
    orders.forEach(o => {
      console.log(`Date: ${o.created_at}, Order: ${o.order_number}, Customer: ${o.customer_name}, Status: ${o.status}, Source: ${o.sales_source}, Channel: ${o.channel}`);
    });
  } else {
    console.log('No orders found for vira');
  }
}
run();
