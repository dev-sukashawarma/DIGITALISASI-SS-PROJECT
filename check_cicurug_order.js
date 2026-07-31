const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const { data: outlets } = await supabase.from('outlets').select('id, name').ilike('name', '%cicurug%');
  console.log('Outlets:', outlets);
  
  if (!outlets || outlets.length === 0) return;
  const outletId = outlets[0].id;
  
  const { data: orders, error } = await supabase.from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', outletId)
    .gte('created_at', '2026-07-28T17:00:00Z') // UTC for 2026-07-29 00:00:00 WIB
    .lt('created_at', '2026-07-29T17:00:00Z'); // UTC for 2026-07-30 00:00:00 WIB

  if (error) {
     console.error(error);
     return;
  }
  
  console.log(`Found ${orders.length} total orders on the 29th.`);
  
  const matches = orders.filter(o => 
    (o.queue_number == 59) || 
    (o.order_number == 59) || 
    (o.receipt_number && o.receipt_number.includes('59'))
  );
  
  console.log('Matches:', JSON.stringify(matches, null, 2));
}
main();
