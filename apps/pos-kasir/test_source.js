
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, source, sales_source, created_at, updated_at, external_order_id')
    .in('id', ['a7cd99ac-5f09-4895-b02f-b4f4d195b80f', 'e8a2196d-f5a7-4f79-9869-ffb4411c6e3b']);
    
  console.log('Data:', data);
}
run();

