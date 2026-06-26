
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, status, source, external_order_id, created_at')
    .eq('source', 'online')
    .in('status', ['preparing', 'ready'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
  } else {
    console.log('Online orders stuck in preparing/ready:', data);
  }
}

run();
