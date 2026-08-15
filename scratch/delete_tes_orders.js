const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteOrders() {
  const outletId = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'; // 'outlet tes'
  
  // 1. Get all order IDs for the outlet
  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('id')
    .eq('outlet_id', outletId);
    
  if (fetchError) {
    console.error('Error fetching orders:', fetchError);
    return;
  }
  
  const orderIds = orders.map(o => o.id);
  console.log(`Found ${orderIds.length} orders for "outlet tes" to delete.`);
  
  if (orderIds.length === 0) {
    console.log('No orders to delete.');
    return;
  }
  
  // 2. Delete order_items
  console.log('Deleting order_items...');
  const { error: itemsError } = await supabase
    .from('order_items')
    .delete()
    .in('order_id', orderIds);
    
  if (itemsError) {
    console.error('Error deleting order_items:', itemsError);
    // Continue anyway, maybe CASCADE is on or they were partially deleted
  } else {
    console.log('Successfully deleted order_items.');
  }

  // Check if there's a payments table
  console.log('Deleting from payments (if exists)...');
  const { error: paymentsError } = await supabase
    .from('payments')
    .delete()
    .in('order_id', orderIds);
  if (paymentsError) {
    console.log('payments table might not exist or no matching column:', paymentsError.message);
  } else {
    console.log('Successfully deleted from payments.');
  }

  // 3. Delete orders
  console.log('Deleting orders...');
  const { error: deleteError } = await supabase
    .from('orders')
    .delete()
    .in('id', orderIds);
    
  if (deleteError) {
    console.error('Error deleting orders:', deleteError);
  } else {
    console.log('Successfully deleted all orders for "outlet tes"!');
  }
}

deleteOrders().catch(console.error);
