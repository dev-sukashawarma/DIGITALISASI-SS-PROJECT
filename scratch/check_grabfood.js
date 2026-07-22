require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGrabfoodOrders() {
  const empangId = '550e8400-e29b-41d4-a716-446655440002';

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', empangId)
    .gte('created_at', '2026-07-20T17:00:00Z')
    .lte('created_at', '2026-07-21T17:00:00Z')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  console.log("=== ALL GRABFOOD ORDERS ON 21/07/2026 ===");
  orders.forEach(o => {
    const ch = (o.channel || o.sales_source || '').toLowerCase();
    if (ch.includes('grab') || o.total_amount === 120000 || (o.customer_name||'').toLowerCase().includes('jayanti')) {
      const items = (o.order_items || []).map(i => `${i.quantity}x ${i.menu_item_name}`).join(', ');
      console.log(`Order #${o.order_number} (ID: ${o.id}) | Cust: '${o.customer_name}' | Channel: '${o.channel||o.sales_source}' | Total: ${o.total_amount} | Items: [${items}] | Time: ${o.created_at}`);
    }
  });
}

checkGrabfoodOrders();
