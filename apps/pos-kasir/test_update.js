
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .update({
      source: 'online',
      sales_source: 'online',
      external_order_id: '21ca58a9-5f37-4194-9c17-8279f32e0427',
      updated_at: new Date().toISOString(),
    })
    .eq('id', '21ca58a9-5f37-4194-9c17-8279f32e0427');
    
  console.log('Error:', error);
  console.log('Result:', data);
}
run();

