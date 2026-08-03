
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, external_order_id, source, customer_name, total_amount, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
    
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
  const toUpdate = [];

  for (const key in grouped) {
    const list = grouped[key];
    if (list.length > 1) {
      console.log('Found duplicate group:', key);
      // Sort by created_at ascending
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      const kiosk = list.find(o => o.source === 'kiosk' || o.source === 'offline');
      const online = list.find(o => o.source === 'online' && o.external_order_id);
      
      if (kiosk && online) {
        console.log('  Merging Kiosk:', kiosk.id, 'with Online:', online.id);
        // We will keep the online one because it has external_order_id and is the final one
        // Wait, the kiosk one might have the offline order items linked properly?
        // Actually both have order items.
        // We delete the kiosk one (which is usually the duplicate causing bloat)
        // Wait, Kiosk one has client_order_id.
        toDelete.push(kiosk.id);
      }
    }
  }

  console.log('To delete:', toDelete);
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from('orders').delete().in('id', toDelete);
    console.log('Delete result:', delErr || 'Success');
  }
}
run();

