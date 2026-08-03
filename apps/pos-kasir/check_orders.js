
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://khpkoreaaucvyqfhynfq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8');

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, external_order_id, customer_name, status, created_at, source')
    .eq('source', 'online')
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) console.error(error);
  console.log(orders);
}
run();

