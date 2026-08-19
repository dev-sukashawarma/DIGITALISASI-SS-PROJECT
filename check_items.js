const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data: outlets } = await supabase.from('outlets').select('id').ilike('name', '%cimanggu%');
  const outletId = outlets[0].id;
  const { data: orders } = await supabase.from('orders')
    .select('id, total_amount, discount_amount, promo_subsidy, order_items(subtotal, quantity)')
    .eq('outlet_id', outletId)
    .eq('status', 'completed')
    .gte('created_at', '2026-08-18T17:00:00Z');
  
  orders.forEach(o => {
    const web_gross = o.total_amount + (o.discount_amount || 0) + (o.promo_subsidy || 0);
    const item_gross = o.order_items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    console.log('Order ID:', o.id);
    console.log('  Web Gross:', web_gross, ' | Item Gross:', item_gross, ' | Difference:', web_gross - item_gross);
  });
}
main();
