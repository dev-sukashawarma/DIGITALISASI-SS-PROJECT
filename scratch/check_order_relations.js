const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRelations() {
  const outletId = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a';
  
  // get order ids
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id')
    .eq('outlet_id', outletId);
    
  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }
  
  const orderIds = orders.map(o => o.id);
  console.log(`Found ${orderIds.length} orders for outlet "outlet tes"`);
  
  if (orderIds.length === 0) return;
  
  // try to fetch order items just to check what the table is called. Maybe 'order_items'?
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('id')
    .in('order_id', orderIds.slice(0, 50));
    
  if (itemsError) {
    console.error('Table order_items might not exist or error:', itemsError);
  } else {
    console.log(`Found ${items.length} items for the first 50 orders.`);
  }
}

checkRelations().catch(console.error);
