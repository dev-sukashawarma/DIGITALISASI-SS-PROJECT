const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL;
const SS_ORDER_KEY = process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY;

const ssOrderDb = createClient(SS_ORDER_URL, SS_ORDER_KEY);

async function main() {
  const { data: orders, error } = await ssOrderDb
    .from('orders')
    .select(`
      id, outlet_id,
      outlets(pos_outlet_id)
    `);

  console.log('Error:', error);
  const nullOutlets = orders.filter(o => !o.outlets || !o.outlets.pos_outlet_id);
  console.log('Orders with null pos_outlet_id:', nullOutlets.length);
  if (nullOutlets.length > 0) {
    console.log(JSON.stringify(nullOutlets[0], null, 2));
  }
}

main();
