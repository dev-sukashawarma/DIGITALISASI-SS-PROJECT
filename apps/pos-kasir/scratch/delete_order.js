const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function deleteOrder() {
  const orderId = '59872885-c570-4d48-9df0-a01ebcd22ad6';

  // Try deleting the order directly. If there's an FK error, we delete items first.
  const { data, error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (error) {
    console.error('Error deleting order:', error);
  } else {
    console.log('Successfully deleted order:', orderId);
  }
}

deleteOrder();
