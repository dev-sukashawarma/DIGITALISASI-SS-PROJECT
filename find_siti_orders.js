const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const { data: outlets } = await supabase.from('outlets').select('id, name').ilike('name', '%cicurug%');
  if (!outlets || outlets.length === 0) {
    console.log('Outlet Cicurug not found');
    return;
  }
  const outletId = outlets[0].id;
  console.log(`Outlet Cicurug ID: ${outletId}`);

  const { data: orders, error } = await supabase.from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', outletId)
    .gte('created_at', '2026-07-30T17:00:00Z') // July 31st WIB
    .lt('created_at', '2026-07-31T17:00:00Z');

  if (error) {
     console.error(error);
     return;
  }
  
  const matches = orders.filter(o => {
    const isSiti = o.customer_name && o.customer_name.toLowerCase().includes('siti');
    const isShopee = o.order_channel && o.order_channel.toLowerCase().includes('shopee');
    return isSiti || isShopee; // We'll just print out potential matches
  });
  
  console.log('Matches:', JSON.stringify(matches, null, 2));
}
main();
