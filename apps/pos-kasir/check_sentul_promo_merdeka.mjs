import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'; // service_role

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSentul() {
  console.log('Checking Sentul orders for 2026-08-17...');

  const { data: outlets } = await supabase.from('outlets').select('*').ilike('name', '%sentul%');
  const sentulId = outlets[0].id;

  const startDate = '2026-08-17T00:00:00+07:00';
  const endDate = '2026-08-17T23:59:59+07:00';
  
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, order_number, total_amount, discount_amount, promo_subsidy, channel, status,
      order_items ( id, menu_item_name, quantity, unit_price, subtotal )
    `)
    .eq('outlet_id', sentulId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .neq('status', 'cancelled');
  
  console.log(`\n--- PROMO MERDEKA ORDERS ---`);
  for (const order of orders) {
    if (order.discount_amount > 0) {
      console.log(`Order #${order.order_number} (${order.channel || 'pos'})`);
      let itemsSubtotal = 0;
      for (const item of order.order_items) {
        itemsSubtotal += Number(item.subtotal);
        console.log(`  - ${item.quantity}x ${item.menu_item_name} @ ${item.unit_price} = ${item.subtotal}`);
      }
      console.log(`  Items Subtotal: ${itemsSubtotal}`);
      console.log(`  Discount Applied (not deducted from total_amount because it's already deducted from unit_price): ${order.discount_amount}`);
      console.log(`  Total Amount Customer Paid: ${order.total_amount}`);
      console.log(`  Gross Omzet (Total + Discount): ${Number(order.total_amount) + Number(order.discount_amount)}`);
    }
  }

  console.log(`\n--- OTHER DISCREPANCIES (PROMO SUBSIDY) ---`);
  for (const order of orders) {
    let itemsSubtotal = 0;
    for (const item of order.order_items) { itemsSubtotal += Number(item.subtotal); }
    
    const expectedTotal = itemsSubtotal - Number(order.promo_subsidy || 0);
    
    if (Math.abs(expectedTotal - Number(order.total_amount)) > 0.01) {
       console.log(`Order #${order.order_number} has mismatch! Subtotal: ${itemsSubtotal}, Subsidy: ${order.promo_subsidy}, Expected: ${expectedTotal}, Actual: ${order.total_amount}`);
    }
  }
}

checkSentul();
