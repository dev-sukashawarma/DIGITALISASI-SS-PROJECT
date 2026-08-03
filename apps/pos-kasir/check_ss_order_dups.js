
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SS_ORDER_URL, process.env.SS_ORDER_SERVICE_KEY || process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customer_name, total, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (error) { console.error(error); return; }
  
  // Find dups by customer_name and total
  const map = {};
  orders.forEach(o => {
    const key = o.customer_name + '_' + o.total;
    if (!map[key]) map[key] = [];
    map[key].push(o);
  });
  const duplicates = Object.values(map).filter(list => list.length > 1);
  console.log('Duplicates in ss_order_db by name & total:', JSON.stringify(duplicates, null, 2));
}
run();

