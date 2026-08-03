
require('dotenv').config({ path: '.env.local' });
const { createServerClient } = require('@supabase/ssr');

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    cookies: {
      getAll() { return [] },
      setAll() {},
    },
  }
);

async function run() {
  const external_order_id = 'a7cd99ac-5f09-4895-b02f-b4f4d195b80f';
  const { data: existingList, error } = await supabase
    .from('orders')
    .select('id, order_number, source, external_order_id')
    .or('id.eq.' + external_order_id + ',external_order_id.eq.' + external_order_id)
    .limit(1);
    
  console.log('Error:', error);
  console.log('Result:', existingList);
}
run();

