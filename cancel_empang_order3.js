const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const orderId = '1128e6f3-3a2c-44d8-b1ef-e6c2e8bce1d6';
  
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      status: 'cancelled', 
      cancellation_status: 'approved',
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select();
    
  if (error) {
    console.error('Error cancelling order:', error);
  } else {
    console.log('Order successfully cancelled:', JSON.stringify(data, null, 2));
  }
}
main();
