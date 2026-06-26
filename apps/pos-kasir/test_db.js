const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkOrders() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, source, total_amount, created_at, external_order_id')
    .eq('source', 'online')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching orders:', error);
  } else {
    console.log('--- 10 Order Online Terakhir di Database POS ---');
    console.log(orders);
    console.log('------------------------------------------------');
    
    // Also count total online orders
    const { count, error: errCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'online');
      
    console.log('Total order online di database:', count);
  }
}

checkOrders();
