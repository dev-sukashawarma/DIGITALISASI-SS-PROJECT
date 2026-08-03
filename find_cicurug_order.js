const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://khpkoreaaucvyqfhynfq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8');
async function findOrder() {
  const { data: outlet } = await supabase.from('outlets').select('id, name').ilike('name', '%cicurug%').limit(1).single();
  if (!outlet) { console.log('Outlet not found'); return; }
  console.log('Outlet:', outlet);
  
  const { data: orders, error } = await supabase.from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', outlet.id)
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) console.error(error);
  else {
    orders.forEach(o => {
      console.log(`Order ID: ${o.id}, Status: ${o.status}, Queue: ${o.queue_number}, Customer: ${o.customer_name}, Platform: ${o.order_channel}`);
      o.order_items.forEach(i => console.log(`  - ${i.quantity}x ${i.menu_name} (${i.notes})`));
    });
  }
}
findOrder();
