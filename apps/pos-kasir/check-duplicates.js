
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const posDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: orders, error } = await posDb.from('orders').select('external_order_id').not('external_order_id', 'is', null);
  if (error) { console.error(error); return; }

  const counts = {};
  for (const o of orders) {
    counts[o.external_order_id] = (counts[o.external_order_id] || 0) + 1;
  }
  const duplicates = Object.entries(counts).filter(([id, c]) => c > 1);
  console.log('Duplicates:', duplicates);
}
run();
