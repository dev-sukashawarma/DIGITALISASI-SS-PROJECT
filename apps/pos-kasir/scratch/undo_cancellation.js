const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function undoCancellation() {
  const orderId = '76541536-2748-49b1-885a-6448be3aa101';

  const { data, error } = await supabase
    .from('orders')
    .update({ cancellation_status: 'none' })
    .eq('id', orderId)
    .select();

  if (error) {
    console.error('Error updating order:', error);
  } else {
    console.log('Successfully undone cancellation for order:', orderId);
    console.log('Updated order:', data);
  }
}

undoCancellation();
