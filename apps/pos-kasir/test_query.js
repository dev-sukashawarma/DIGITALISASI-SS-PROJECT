
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const external_order_id = 'a7cd99ac-5f09-4895-b02f-b4f4d195b80f';
  const { data: existingList, error } = await supabase
    .from('orders')
    .select('id, order_number, source, external_order_id, created_at')
    .or('id.eq.' + external_order_id + ',external_order_id.eq.' + external_order_id);
    
  console.log('Error:', error);
  console.log('Result:', existingList);
}
run();

