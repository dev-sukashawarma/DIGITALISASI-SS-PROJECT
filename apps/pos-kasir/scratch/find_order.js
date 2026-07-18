const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function findOrder() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, status, cancellation_status, created_at, customer_name, total_amount')
    .eq('order_number', '4')
    .gte('created_at', '2026-07-17T17:00:00Z') // July 18 WIB
    .lte('created_at', '2026-07-18T17:00:00Z');

  if (error) {
    console.error('Error fetching orders:', error);
  } else {
    console.log('Found orders:', orders.length);
    orders.forEach(o => {
      console.log(`ID: ${o.id}, Status: ${o.status}, CancStatus: ${o.cancellation_status}, Order#: ${o.order_number}, CreatedAt: ${o.created_at}`);
    });
  }
}

findOrder();
