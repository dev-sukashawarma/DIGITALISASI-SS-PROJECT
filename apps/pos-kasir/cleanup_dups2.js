
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, external_order_id, source, customer_name, total_amount, created_at, order_number')
    .order('created_at', { ascending: false })
    .limit(3000);
    
  if (error) {
    console.error(error);
    return;
  }

  // Find duplicates
  const grouped = {};
  for (const o of orders) {
    if (!o.customer_name || !o.total_amount) continue;
    const date = new Date(o.created_at).toISOString().split('T')[0];
    const key = o.customer_name.toLowerCase() + '|' + o.total_amount + '|' + date;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  }

  const toDelete = [];

  for (const key in grouped) {
    const list = grouped[key];
    if (list.length > 1) {
      // Sort by created_at ascending
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      console.log('\nGroup:', key);
      list.forEach(o => console.log('  ', o.id, o.source, o.external_order_id, o.created_at, o.order_number));
      
      const kiosk = list.find(o => o.source === 'kiosk' || o.source === 'offline');
      const online = list.find(o => o.source === 'online');
      
      if (kiosk && online) {
        console.log('  -> Duplicate detected across source (Kiosk/Online)');
        // Delete the kiosk duplicate because online has the proper Midtrans external_order_id
        toDelete.push(kiosk.id);
      } else {
        console.log('  -> Multiple orders same source/name/amount, could be legit distinct orders.');
      }
    }
  }

  console.log('\nTo delete:', toDelete);
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from('orders').delete().in('id', toDelete);
    console.log('Delete result:', delErr || 'Success');
  }
}
run();

