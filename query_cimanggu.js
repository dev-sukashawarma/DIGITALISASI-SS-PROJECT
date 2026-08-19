const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function main() {
  const { data: outlets } = await supabase.from('outlets').select('id, name').ilike('name', '%cimanggu%');
  console.log('Outlets:', outlets);
  if (outlets && outlets.length > 0) {
    const { data: orders } = await supabase.from('orders')
      .select('id, status, cancellation_status, total_amount, discount_amount, promo_subsidy, created_at, channel, payment_method')
      .eq('outlet_id', outlets[0].id)
      .gte('created_at', '2026-08-18T17:00:00Z')
      .order('created_at', { ascending: false });
    console.log('Orders Count:', orders ? orders.length : 0);
    console.log('Orders:', orders);
  }
}
main();
