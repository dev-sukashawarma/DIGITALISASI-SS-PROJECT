
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const posKasirDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ssOrderDb = createClient(
  process.env.NEXT_PUBLIC_SS_ORDER_URL,
  process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY
);

async function run() {
  const { data: localOrders } = await posKasirDb
    .from('orders')
    .select('id, external_order_id, status')
    .eq('source', 'online')
    .in('status', ['preparing', 'ready']);

  const externalIds = localOrders.map(o => o.external_order_id).filter(Boolean);
  console.log('externalIds:', externalIds);

  const { data: remoteOrders, error: remoteErr } = await ssOrderDb
    .from('orders')
    .select('id, status')
    .in('id', externalIds);

  console.log('remoteOrders:', remoteOrders);
  console.log('remoteErr:', remoteErr);
}

run();
