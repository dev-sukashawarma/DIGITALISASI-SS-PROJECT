const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const idsToCancel = [
    'caf5d8e3-3a93-42fe-a1dd-a73e022c522d', // #42
    'd7b4ca58-8755-413d-b82d-85700e4881a3'  // #43
  ];
  
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      status: 'cancelled', 
      cancellation_status: 'approved',
      cancellation_reason: 'cancelled by admin',
      updated_at: new Date().toISOString()
    })
    .in('id', idsToCancel)
    .select('order_number, status, cancellation_reason');
    
  if (error) {
    console.error('Error cancelling orders:', error);
  } else {
    console.log('Orders successfully cancelled:', JSON.stringify(data, null, 2));
  }
}
main();
