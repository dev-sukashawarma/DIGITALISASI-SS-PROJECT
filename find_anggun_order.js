const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  // Search for the order with order_number 30, customer_name containing 'Anggun', and cancellation_status pending
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      customer_name,
      status,
      cancellation_status,
      created_at,
      outlet_id,
      outlets ( name )
    `)
    .ilike('customer_name', '%Anggun%')
    .eq('order_number', 30);
    
  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }
  
  if (orders && orders.length > 0) {
    console.log('Found orders:', JSON.stringify(orders, null, 2));
  } else {
    console.log('No order found with number 30 and name Anggun.');
    
    // Fallback: just search by Anggun
    const { data: ordersFallback } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, status, cancellation_status, created_at, outlets(name)')
      .ilike('customer_name', '%Anggun%')
      .order('created_at', { ascending: false })
      .limit(5);
    console.log('Recent orders with name Anggun:', JSON.stringify(ordersFallback, null, 2));
  }
}

main();
