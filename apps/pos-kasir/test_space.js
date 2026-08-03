
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, external_order_id')
    .in('id', ['e8a2196d-f5a7-4f79-9869-ffb4411c6e3b']);
    
  console.log('ID length:', data[0].external_order_id.length);
  console.log('ID:', JSON.stringify(data[0].external_order_id));
}
run();

