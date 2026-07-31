const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const outletId = '550e8400-e29b-41d4-a716-446655440005';
  
  const { data: shifts, error: shiftError } = await supabase.from('shifts')
    .select('*')
    .eq('outlet_id', outletId)
    .gte('start_time', '2026-07-28T17:00:00Z')
    .lt('start_time', '2026-07-29T17:00:00Z');

  if (shiftError) {
     console.error('Shifts error:', shiftError);
     return;
  }
  console.log('Shifts on the 29th:', JSON.stringify(shifts, null, 2));
  
  const { data: orders, error } = await supabase.from('orders')
    .select('id, order_number, customer_name, status, payment_method, total_amount, created_at, updated_at, source, channel')
    .eq('outlet_id', outletId)
    .in('customer_name', ['Eka', 'Eno']);

  if (error) {
     console.error(error);
     return;
  }
  
  console.log('Orders for Eka/Eno:', JSON.stringify(orders, null, 2));
}
main();
