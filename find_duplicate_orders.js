const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const { data: orders, error } = await supabase.from('orders')
    .select('id, outlet_id, order_number, customer_name, total_amount, payment_method, created_at, updated_at, source, channel')
    .eq('customer_name', 'M')
    .eq('total_amount', 34000)
    .gte('created_at', '2026-07-29T12:00:00Z')
    .lt('created_at', '2026-07-29T14:00:00Z')
    .order('created_at', { ascending: true });

  if (error) {
     console.error(error);
     return;
  }
  
  if (orders.length > 0) {
     const outletId = orders[0].outlet_id;
     const { data: outlet } = await supabase.from('outlets').select('name').eq('id', outletId).single();
     console.log('Outlet:', outlet ? outlet.name : 'Unknown');
  } else {
     console.log('No orders found with exactly these criteria. Trying broader search...');
     // Broaden search
     const { data: orders2 } = await supabase.from('orders')
        .select('id, outlet_id, order_number, customer_name, total_amount, payment_method, created_at, updated_at, source, channel')
        .eq('customer_name', 'M')
        .gte('created_at', '2026-07-29T10:00:00Z')
        .lt('created_at', '2026-07-29T16:00:00Z')
        .order('created_at', { ascending: true });
     console.log('Broader search orders:', JSON.stringify(orders2, null, 2));
     if(orders2 && orders2.length > 0) {
         const { data: outlet2 } = await supabase.from('outlets').select('name').eq('id', orders2[0].outlet_id).single();
         console.log('Outlet from broader search:', outlet2 ? outlet2.name : 'Unknown');
     }
     return;
  }
  
  console.log('Orders found:', JSON.stringify(orders, null, 2));
}
main();
